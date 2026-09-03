/**
 * Gameweek selectors over the bootstrap event list. "Resolved" means the
 * gameweek is fully settled (bonus, auto-subs, final standings) — the only
 * baseline exposure is ever computed from.
 */

import type { Bootstrap } from '@/lib/fpl/normalise';
import type { Gameweek } from '@/lib/types';

export function currentGameweek(bs: Bootstrap): Gameweek | null {
  return (
    bs.events.find((e) => e.isCurrent) ??
    bs.events.find((e) => e.isNext) ??
    bs.events.find((e) => !e.finished) ??
    bs.events.at(-1) ??
    null
  );
}

export function nextGameweek(bs: Bootstrap): Gameweek | null {
  return (
    bs.events.find((e) => e.isNext) ??
    bs.events.find((e) => !e.finished) ??
    null
  );
}

/**
 * The most recent gameweek that is finished AND data-checked. Rival picks for
 * this GW are immutable, so it is the baseline for every exposure figure.
 */
export function lastResolvedGameweek(bs: Bootstrap): Gameweek | null {
  const resolved = bs.events.filter((e) => e.finished && e.dataChecked);
  return resolved.at(-1) ?? null;
}

/** The GW whose deadline has most recently passed (finished or in progress). */
export function lastDeadlinePassedGameweek(bs: Bootstrap): Gameweek | null {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const passed = bs.events.filter((e) => e.deadlineEpoch <= nowEpoch);
  return passed.at(-1) ?? null;
}
