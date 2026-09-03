/**
 * Projected points for a player in a given gameweek.
 *
 * There is no official projection in the FPL API. This one is deliberately
 * crude and lives behind a single function so it can be improved later without
 * touching anything else. Threats and differentials are both ranked with it, so
 * systematic bias mostly cancels out.
 *
 *   projectedPoints = pointsPerGame
 *                   x formAdjustment          blend season PPG with recent form
 *                   x fixtureAdjustment       opponent difficulty, home/away
 *                   x availabilityAdjustment  chanceOfPlaying / 100, 0 if not 'a'
 *
 * Doubles get the sum of both fixtures; blanks get zero.
 */

import type { Fixture, Player } from '@/lib/types';

/** One fixture for the player's team in the target GW. */
export interface ProjectionFixture {
  /** difficulty for THIS player's team, 1 (easy) - 5 (hard) */
  difficulty: number;
  isHome: boolean;
}

const DIFFICULTY_MULTIPLIER: Record<number, number> = {
  1: 1.15,
  2: 1.07,
  3: 1.0,
  4: 0.9,
  5: 0.8,
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

function formAdjustment(player: Player): number {
  const ppg = Math.max(player.pointsPerGame, 0.1);
  return clamp(0.6 + 0.4 * (player.form / ppg), 0.5, 1.6);
}

function availabilityAdjustment(player: Player): number {
  if (player.status !== 'a') return 0;
  return player.chanceOfPlaying === null ? 1 : player.chanceOfPlaying / 100;
}

function fixtureAdjustment(fixtures: ProjectionFixture[]): number {
  // Sum across fixtures so a DGW roughly doubles and a blank is zero.
  return fixtures.reduce((total, f) => {
    const diff = DIFFICULTY_MULTIPLIER[f.difficulty] ?? 1.0;
    const homeBonus = f.isHome ? 1.03 : 0.98;
    return total + diff * homeBonus;
  }, 0);
}

export function projectedPoints(
  player: Player,
  fixtures: ProjectionFixture[],
): number {
  if (fixtures.length === 0) return 0; // blank
  const base = Math.max(player.pointsPerGame, 0);
  const projected =
    base *
    formAdjustment(player) *
    fixtureAdjustment(fixtures) *
    availabilityAdjustment(player);
  return Math.round(projected * 100) / 100;
}

/**
 * Resolve a team's fixtures in a GW into ProjectionFixture[] from the raw
 * Fixture list. Exported so routes can build the input consistently.
 */
export function teamFixturesForGameweek(
  teamId: number,
  gameweek: number,
  allFixtures: Fixture[],
): ProjectionFixture[] {
  return allFixtures
    .filter(
      (f) =>
        f.gameweek === gameweek &&
        (f.homeTeamId === teamId || f.awayTeamId === teamId),
    )
    .map((f) => {
      const isHome = f.homeTeamId === teamId;
      return {
        isHome,
        difficulty: isHome ? f.homeDifficulty : f.awayDifficulty,
      };
    });
}
