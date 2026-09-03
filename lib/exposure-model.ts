/**
 * The expensive computation, done once. /threats, /differentials, /captaincy
 * and /gap are all cheap projections over this.
 *
 * Exposure is "as of the last resolved gameweek" (the blackout — see spec).
 * Projections are for the next gameweek (the one being planned).
 */

import { cache } from 'react';

import { getConfig } from '@/lib/config';
import {
  computeExposure,
  swing,
  type EntrySquad,
  type ExposureRow,
} from '@/lib/exposure';
import { fetchBootstrap, fetchFixtures } from '@/lib/fpl/endpoints';
import {
  normaliseBootstrap,
  normaliseChipName,
  normaliseFixture,
  normalisePick,
  type Bootstrap,
} from '@/lib/fpl/normalise';
import { fetchEntryPicks } from '@/lib/fpl/endpoints';
import {
  currentGameweek,
  lastResolvedGameweek,
  nextGameweek,
} from '@/lib/gameweek';
import { buildLeague } from '@/lib/league';
import {
  projectedPoints,
  teamFixturesForGameweek,
  type ProjectionFixture,
} from '@/lib/projection';
import type {
  ChipName,
  Fixture,
  LeagueStanding,
  Pick,
  Player,
  RivalSquad,
} from '@/lib/types';

export interface PlayerExposure extends ExposureRow {
  player: Player;
  fixtureLabel: string;
  /** compact run of the next few gameweeks, e.g. "h BUR (2) · a LIV (4)" */
  fixtureRun: { gameweek: number; label: string; difficulty: number }[];
  projectedPoints: number;
  /** netEO x projected — positive gains me ground, negative loses it */
  swing: number;
  /** -netEO x projected, floored at 0 — "how much this player hurts me" */
  expectedDamage: number;
  /** netEO x projected, floored at 0 — "how much this player gains me" */
  expectedGain: number;
}

export interface CaptaincyEntry {
  playerId: number;
  webName: string;
  teamShort: string;
  count: number;
  rivalIds: number[];
  isMyCaptain: boolean;
}

export interface ExposureModel {
  leagueId: string;
  leagueName: string;
  myEntryId: number;
  asOfGw: number;
  targetGw: number;
  rivalCount: number;
  rivals: { entryId: number; entryName: string; playerName: string }[];
  rivalsFull: RivalSquad[];
  standings: LeagueStanding[];
  mine: { picks: Pick[]; activeChip: ChipName | null };
  players: PlayerExposure[];
  captaincy: CaptaincyEntry[];
  /** sum of swing across all players — the "about to gain or lose ground" number */
  expectedSwingTotal: number;
}

function labelFixturesInGw(
  teamId: number,
  gameweek: number,
  fixtures: Fixture[],
  bs: Bootstrap,
): { label: string; difficulty: number } {
  const rows = fixtures.filter(
    (f) =>
      f.gameweek === gameweek &&
      (f.homeTeamId === teamId || f.awayTeamId === teamId),
  );
  if (rows.length === 0) return { label: '—', difficulty: 3 };
  const parts = rows.map((f) => {
    const isHome = f.homeTeamId === teamId;
    const oppId = isHome ? f.awayTeamId : f.homeTeamId;
    const opp = bs.teams.get(oppId)?.shortName ?? '???';
    const diff = isHome ? f.homeDifficulty : f.awayDifficulty;
    return { text: `${isHome ? 'h' : 'a'} ${opp} (${diff})`, diff };
  });
  return {
    label: parts.map((p) => p.text).join(', '),
    difficulty:
      parts.reduce((s, p) => s + p.diff, 0) / Math.max(1, parts.length),
  };
}

function fixtureRun(
  teamId: number,
  fromGw: number,
  count: number,
  fixtures: Fixture[],
  bs: Bootstrap,
): { gameweek: number; label: string; difficulty: number }[] {
  const out: { gameweek: number; label: string; difficulty: number }[] = [];
  for (let gw = fromGw; gw < fromGw + count; gw++) {
    const { label, difficulty } = labelFixturesInGw(teamId, gw, fixtures, bs);
    out.push({ gameweek: gw, label, difficulty });
  }
  return out;
}

async function build(leagueId: string): Promise<ExposureModel> {
  const { entryId } = getConfig();
  const numericLeagueId = Number.parseInt(leagueId, 10);

  const [rawBootstrap, rawFixtures] = await Promise.all([
    fetchBootstrap(),
    fetchFixtures(),
  ]);
  const bs = normaliseBootstrap(rawBootstrap);
  const fixtures = rawFixtures.map(normaliseFixture);

  const resolved = lastResolvedGameweek(bs);
  const next = nextGameweek(bs) ?? currentGameweek(bs);
  const asOfGw = resolved?.id ?? Math.max(1, (currentGameweek(bs)?.id ?? 1) - 1);
  const targetGw = next?.id ?? asOfGw + 1;

  const [myPicksRes, built] = await Promise.all([
    fetchEntryPicks(entryId, asOfGw),
    buildLeague(numericLeagueId, asOfGw),
  ]);

  const mine = {
    picks: (myPicksRes.picks ?? []).map(normalisePick),
    activeChip: normaliseChipName(myPicksRes.active_chip),
  };

  const rivalSquads: EntrySquad[] = built.rivals.map((r) => ({
    entryId: r.entryId,
    picks: r.picks,
    activeChip: r.activeChip,
  }));

  const exposure = computeExposure(mine, rivalSquads);

  const players: PlayerExposure[] = [];
  let expectedSwingTotal = 0;

  for (const row of exposure.values()) {
    const player = bs.players.get(row.playerId);
    if (!player) continue;

    const projFixtures: ProjectionFixture[] = teamFixturesForGameweek(
      player.teamId,
      targetGw,
      fixtures,
    );
    const projected = projectedPoints(player, projFixtures);
    const s = swing(row.netEO, projected);
    expectedSwingTotal += s;

    players.push({
      ...row,
      player,
      fixtureLabel: labelFixturesInGw(player.teamId, targetGw, fixtures, bs).label,
      fixtureRun: fixtureRun(player.teamId, targetGw, 5, fixtures, bs),
      projectedPoints: projected,
      swing: s,
      expectedDamage: s < 0 ? -s : 0,
      expectedGain: s > 0 ? s : 0,
    });
  }

  // Captaincy distribution among rivals for the resolved GW.
  const capCount = new Map<number, number[]>();
  for (const r of built.rivals) {
    const cap = r.picks.find((p) => p.isCaptain);
    if (!cap) continue;
    const list = capCount.get(cap.playerId) ?? [];
    list.push(r.entryId);
    capCount.set(cap.playerId, list);
  }
  const myCaptainId = mine.picks.find((p) => p.isCaptain)?.playerId ?? null;
  const captaincy: CaptaincyEntry[] = [...capCount.entries()]
    .map(([playerId, rivalIds]) => {
      const p = bs.players.get(playerId);
      return {
        playerId,
        webName: p?.webName ?? `#${playerId}`,
        teamShort: p?.teamShort ?? '???',
        count: rivalIds.length,
        rivalIds,
        isMyCaptain: playerId === myCaptainId,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    leagueId,
    leagueName: built.league.name,
    myEntryId: entryId,
    asOfGw,
    targetGw,
    rivalCount: built.rivals.length,
    rivals: built.rivals.map((r) => ({
      entryId: r.entryId,
      entryName: r.entryName,
      playerName: r.playerName,
    })),
    rivalsFull: built.rivals,
    standings: built.league.standings,
    mine,
    players,
    captaincy,
    expectedSwingTotal: Math.round(expectedSwingTotal * 100) / 100,
  };
}

/** Request-scoped memoisation; upstream fetches carry their own TTLs. */
export const getExposureModel = cache(build);
