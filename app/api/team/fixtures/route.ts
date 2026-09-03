import type { NextRequest } from 'next/server';

import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';
import { getMyFixtureTicker } from '@/lib/team';

export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const horizonRaw = Number.parseInt(
      req.nextUrl.searchParams.get('horizon') ?? '6',
      10,
    );
    const horizon = Number.isFinite(horizonRaw)
      ? Math.min(Math.max(horizonRaw, 1), 10)
      : 6;

    const ticker = await getMyFixtureTicker(horizon);
    return envelope(ticker, { gameStatus, asOfGw: ticker.gameweek });
  });
}
