/**
 * League assembly: standings, plus the fan-out of resolved picks + chip history
 * for every rival. Unglamorous, but everything in the app depends on it.
 *
 * The pre-deadline blackout: rival squads for the upcoming gameweek are
 * unknowable until the deadline passes. Exposure is therefore always computed
 * from the last *resolved* gameweek. Both `picks` and `history` for a resolved
 * GW are immutable, so they cache hard.
 */

import { getConfig } from '@/lib/config';
import { mapLimit } from '@/lib/concurrency';
import {
  fetchEntryHistory,
  fetchEntryPicks,
  fetchLeagueStandings,
} from '@/lib/fpl/endpoints';
import {
  normaliseAutomaticSubs,
  normaliseChipName,
  normaliseChipsUsed,
  normalisePick,
  normaliseStanding,
} from '@/lib/fpl/normalise';
import type { League, LeagueStanding, RivalSquad } from '@/lib/types';

const FANOUT_CONCURRENCY = 5;
const MAX_STANDINGS_PAGES = 20; // safety valve for very large leagues

export async function getLeague(leagueId: number): Promise<League> {
  const standings: LeagueStanding[] = [];
  let page = 1;
  let name = `League ${leagueId}`;

  while (page <= MAX_STANDINGS_PAGES) {
    const res = await fetchLeagueStandings(leagueId, page);
    name = res.league?.name ?? name;
    for (const r of res.standings?.results ?? []) {
      standings.push(normaliseStanding(r));
    }
    if (!res.standings?.has_next) break;
    page += 1;
  }

  return { id: leagueId, name, standings };
}

/**
 * Which rivals to fetch. Everyone except me, optionally narrowed to a window of
 * N rows either side of my position for large leagues (FPL_RIVAL_WINDOW).
 */
export function selectRivals(
  standings: LeagueStanding[],
  myEntryId: number,
  window: number | undefined,
): LeagueStanding[] {
  const rivals = standings.filter((s) => s.entryId !== myEntryId);
  if (!window) return rivals;

  const sorted = [...standings].sort((a, b) => a.rank - b.rank);
  const myIdx = sorted.findIndex((s) => s.entryId === myEntryId);
  if (myIdx === -1) return rivals.slice(0, window * 2);

  const lo = Math.max(0, myIdx - window);
  const hi = Math.min(sorted.length, myIdx + window + 1);
  const nearIds = new Set(
    sorted.slice(lo, hi).map((s) => s.entryId),
  );
  nearIds.delete(myEntryId);
  return rivals.filter((r) => nearIds.has(r.entryId));
}

async function fetchRivalSquad(
  standing: LeagueStanding,
  gameweek: number,
): Promise<RivalSquad> {
  const [picksRes, historyRes] = await Promise.all([
    fetchEntryPicks(standing.entryId, gameweek),
    fetchEntryHistory(standing.entryId),
  ]);

  return {
    entryId: standing.entryId,
    entryName: standing.entryName,
    playerName: standing.playerName,
    gameweek,
    picks: (picksRes.picks ?? []).map(normalisePick),
    automaticSubs: normaliseAutomaticSubs(picksRes),
    activeChip: normaliseChipName(picksRes.active_chip),
    chipsUsed: normaliseChipsUsed(historyRes),
  };
}

export interface BuiltLeague {
  league: League;
  /** rivals only — never includes my own entry */
  rivals: RivalSquad[];
  gameweek: number;
}

export async function buildLeague(
  leagueId: number,
  resolvedGameweek: number,
): Promise<BuiltLeague> {
  const { entryId, rivalWindow } = getConfig();
  const league = await getLeague(leagueId);
  const rivalRows = selectRivals(league.standings, entryId, rivalWindow);

  const rivals = await mapLimit(rivalRows, FANOUT_CONCURRENCY, (row) =>
    fetchRivalSquad(row, resolvedGameweek),
  );

  return { league, rivals, gameweek: resolvedGameweek };
}
