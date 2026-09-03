/**
 * getGameStatus() — the single downtime signal, checked at the top of every
 * route handler and by both crons.
 *
 * FPL takes the game offline for a while after each deadline to process the
 * gameweek. Data pulled mid-processing can be partial, so when this is not
 * 'live' the app serves cached data only and skips all writes.
 */

import { DowntimeError, FplRequestError } from '@/lib/fpl/client';
import { fetchEventStatus } from '@/lib/fpl/endpoints';
import type { GameStatus } from '@/lib/types';

/** Override for local testing of the downtime path. Set FPL_FORCE_STATUS. */
function forced(): GameStatus | null {
  const v = process.env.FPL_FORCE_STATUS;
  return v === 'live' || v === 'updating' || v === 'unavailable' ? v : null;
}

export async function getGameStatus(): Promise<GameStatus> {
  const override = forced();
  if (override) return override;

  try {
    const status = await fetchEventStatus();
    // `leagues` reads "Updated" when league processing is complete, and
    // "Updating" (or similar) while it is still running.
    if (typeof status.leagues === 'string' && status.leagues !== 'Updated') {
      return 'updating';
    }
    return 'live';
  } catch (err) {
    if (err instanceof DowntimeError) return 'unavailable';
    // A clean 4xx is a real error (bad config), not downtime — but for the
    // banner's purposes we still can't trust live data, so degrade safely.
    if (err instanceof FplRequestError) return 'unavailable';
    return 'unavailable';
  }
}
