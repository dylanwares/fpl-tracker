/**
 * Build the records the cron routes persist. The FPL API keeps no history for
 * standings, resolved rival picks or prices, so a snapshot after each settled
 * gameweek is the only way the deadline diff and price history can exist.
 */

import { getConfig } from '@/lib/config';
import { computeExposure, type EntrySquad } from '@/lib/exposure';
import { fetchBootstrap, fetchEntryPicks } from '@/lib/fpl/endpoints';
import {
  normaliseBootstrap,
  normaliseChipName,
  normalisePick,
} from '@/lib/fpl/normalise';
import { buildLeague } from '@/lib/league';
import type { LeagueSnapshot, PriceSnapshot } from '@/lib/store/schema';

export async function buildLeagueSnapshot(
  leagueId: number,
  gw: number,
): Promise<LeagueSnapshot> {
  const { entryId } = getConfig();

  const [built, myPicksRes] = await Promise.all([
    buildLeague(leagueId, gw),
    fetchEntryPicks(entryId, gw),
  ]);

  const mine = {
    picks: (myPicksRes.picks ?? []).map(normalisePick),
    automaticSubs: (myPicksRes.automatic_subs ?? []).map((s) => ({
      inId: s.element_in,
      outId: s.element_out,
    })),
    activeChip: normaliseChipName(myPicksRes.active_chip),
  };

  const rivalSquads: EntrySquad[] = built.rivals.map((r) => ({
    entryId: r.entryId,
    picks: r.picks,
    activeChip: r.activeChip,
  }));

  const exposure = computeExposure(mine, rivalSquads);
  const exposureRecord: LeagueSnapshot['exposure'] = {};
  for (const [playerId, row] of exposure) exposureRecord[playerId] = row;

  return {
    version: 1,
    leagueId,
    gw,
    takenAt: new Date().toISOString(),
    standings: built.league.standings,
    mine,
    rivals: built.rivals.map((r) => ({
      entryId: r.entryId,
      entryName: r.entryName,
      playerName: r.playerName,
      picks: r.picks,
      automaticSubs: r.automaticSubs,
      activeChip: r.activeChip,
      captainId: r.picks.find((p) => p.isCaptain)?.playerId ?? null,
      chipsUsed: r.chipsUsed,
    })),
    exposure: exposureRecord,
  };
}

export async function buildPriceSnapshot(): Promise<PriceSnapshot> {
  const bs = normaliseBootstrap(await fetchBootstrap());
  const today = new Date().toISOString().slice(0, 10);
  return {
    version: 1,
    date: today,
    takenAt: new Date().toISOString(),
    rows: [...bs.players.values()].map((p) => ({
      id: p.id,
      webName: p.webName,
      nowCost: p.price,
      costChangeEvent: p.priceChangeEvent,
    })),
  };
}

/**
 * Guard for the snapshot cron: the gameweek it is about to store must actually
 * be finished and data-checked, otherwise a partial write corrupts next week's
 * diff.
 */
export function resolvedGameweekToSnapshot(
  events: ReturnType<typeof normaliseBootstrap>['events'],
): number | null {
  const done = events.filter((e) => e.finished && e.dataChecked);
  return done.at(-1)?.id ?? null;
}
