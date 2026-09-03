/**
 * My own team: current squad joined to player detail, season history, and the
 * per-owned-player fixture ticker. Overall rank lives here and nowhere else in
 * the app.
 */

import { getConfig } from '@/lib/config';
import { FplRequestError } from '@/lib/fpl/client';
import {
  fetchBootstrap,
  fetchEntry,
  fetchEntryHistory,
  fetchEntryPicks,
  fetchFixtures,
} from '@/lib/fpl/endpoints';
import {
  normaliseBootstrap,
  normaliseChipName,
  normaliseEntrySummary,
  normaliseFixture,
  normaliseHistory,
  normalisePick,
  type Bootstrap,
} from '@/lib/fpl/normalise';
import { currentGameweek, lastResolvedGameweek } from '@/lib/gameweek';
import type {
  ChipName,
  EntrySummary,
  Fixture,
  GameweekEntry,
  Pick,
  Player,
} from '@/lib/types';

export interface SquadSlot {
  pick: Pick;
  player: Player;
}

export interface MySquad {
  entry: EntrySummary;
  gameweek: number;
  activeChip: ChipName | null;
  /** slots 1-15 in squad order; 1-11 start, 12-15 bench */
  slots: SquadSlot[];
}

async function picksForGameweek(entryId: number, gw: number) {
  return fetchEntryPicks(entryId, gw);
}

export async function getMySquad(): Promise<MySquad> {
  const { entryId } = getConfig();
  const [rawEntry, rawBootstrap] = await Promise.all([
    fetchEntry(entryId),
    fetchBootstrap(),
  ]);
  const bs = normaliseBootstrap(rawBootstrap);
  const entry = normaliseEntrySummary(rawEntry);

  const preferredGw =
    entry.currentEvent ||
    currentGameweek(bs)?.id ||
    lastResolvedGameweek(bs)?.id ||
    1;

  let gw = preferredGw;
  let picksRes;
  try {
    picksRes = await picksForGameweek(entryId, gw);
  } catch (err) {
    if (err instanceof FplRequestError && err.status === 404) {
      gw = lastResolvedGameweek(bs)?.id ?? Math.max(1, preferredGw - 1);
      picksRes = await picksForGameweek(entryId, gw);
    } else {
      throw err;
    }
  }

  const slots: SquadSlot[] = (picksRes.picks ?? [])
    .map(normalisePick)
    .sort((a, b) => a.position - b.position)
    .map((pick) => ({
      pick,
      player:
        bs.players.get(pick.playerId) ??
        ({
          id: pick.playerId,
          webName: `#${pick.playerId}`,
          fullName: `#${pick.playerId}`,
          teamId: 0,
          teamShort: '???',
          position: 'MID',
          price: 0,
          totalPoints: 0,
          form: 0,
          pointsPerGame: 0,
          selectedByPercent: 0,
          xG: 0,
          xA: 0,
          xGI90: 0,
          expectedGoalsConceded: 0,
          status: 'a',
          chanceOfPlaying: null,
          news: '',
          priceChangeEvent: 0,
        } satisfies Player),
    }));

  return {
    entry,
    gameweek: gw,
    activeChip: normaliseChipName(picksRes.active_chip),
    slots,
  };
}

export async function getMyHistory(): Promise<GameweekEntry[]> {
  const { entryId } = getConfig();
  return normaliseHistory(await fetchEntryHistory(entryId));
}

export interface FixtureTickerRow {
  player: Player;
  fixtures: {
    gameweek: number;
    opponentShort: string;
    isHome: boolean;
    difficulty: number;
  }[];
  /** mean difficulty over the horizon, for sorting */
  averageDifficulty: number;
}

export async function getMyFixtureTicker(
  horizon: number,
): Promise<{ gameweek: number; rows: FixtureTickerRow[] }> {
  const [squad, rawFixtures, rawBootstrap] = await Promise.all([
    getMySquad(),
    fetchFixtures(),
    fetchBootstrap(),
  ]);
  const bs: Bootstrap = normaliseBootstrap(rawBootstrap);
  const fixtures: Fixture[] = rawFixtures.map(normaliseFixture);
  const fromGw = (currentGameweek(bs)?.id ?? 1);

  const rows: FixtureTickerRow[] = squad.slots.map(({ player }) => {
    const upcoming = fixtures
      .filter(
        (f) =>
          f.gameweek !== null &&
          f.gameweek >= fromGw &&
          f.gameweek < fromGw + horizon &&
          (f.homeTeamId === player.teamId || f.awayTeamId === player.teamId),
      )
      .sort((a, b) => (a.gameweek ?? 0) - (b.gameweek ?? 0))
      .map((f) => {
        const isHome = f.homeTeamId === player.teamId;
        const oppId = isHome ? f.awayTeamId : f.homeTeamId;
        return {
          gameweek: f.gameweek as number,
          opponentShort: bs.teams.get(oppId)?.shortName ?? '???',
          isHome,
          difficulty: isHome ? f.homeDifficulty : f.awayDifficulty,
        };
      });

    const averageDifficulty =
      upcoming.length > 0
        ? upcoming.reduce((s, f) => s + f.difficulty, 0) / upcoming.length
        : 0;

    return { player, fixtures: upcoming, averageDifficulty };
  });

  return { gameweek: fromGw, rows };
}
