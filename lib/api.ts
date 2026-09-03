/**
 * Helpers shared by the internal API routes. Every route returns an
 * ApiEnvelope<T> (never raw upstream JSON) and stamps it with the game status
 * and the gameweek the figures are "as of".
 */

import { NextResponse } from 'next/server';

import { DowntimeError, FplRequestError } from '@/lib/fpl/client';
import type { ApiEnvelope, GameStatus } from '@/lib/types';

export function envelope<T>(
  data: T,
  meta: { asOfGw?: number | null; gameStatus: GameStatus; stale?: boolean },
): NextResponse {
  const body: ApiEnvelope<T> = {
    data,
    meta: {
      asOfGw: meta.asOfGw ?? null,
      gameStatus: meta.gameStatus,
      stale: meta.stale ?? false,
      generatedAt: new Date().toISOString(),
    },
  };
  return NextResponse.json(body, {
    headers: { 'x-fpl-status': meta.gameStatus },
  });
}

export function apiError(
  message: string,
  status: number,
  gameStatus: GameStatus = 'live',
): NextResponse {
  return NextResponse.json(
    { error: message, meta: { gameStatus } },
    { status, headers: { 'x-fpl-status': gameStatus } },
  );
}

/**
 * Wrap a route body. Translates the FPL client's error types into sensible HTTP
 * responses so a single failing upstream call doesn't 500 the whole route.
 */
export async function runRoute(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof DowntimeError) {
      return apiError(
        'FPL is updating or unavailable. No cached data for this view yet.',
        503,
        'unavailable',
      );
    }
    if (err instanceof FplRequestError) {
      return apiError(`Upstream FPL error (${err.status}).`, 502);
    }
    if (err instanceof Error && /Missing required env var/.test(err.message)) {
      return apiError(err.message, 500);
    }
    console.error('[route] unhandled error', err);
    return apiError('Unexpected error building this view.', 500);
  }
}
