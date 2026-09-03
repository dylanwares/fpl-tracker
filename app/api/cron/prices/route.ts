import { NextResponse } from 'next/server';

import { checkCronAuth } from '@/lib/cron';
import { getGameStatus } from '@/lib/fpl/status';
import { buildPriceSnapshot } from '@/lib/snapshot';
import { getStore, keys } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs ~02:00 UK daily. Captures the price-change deltas for the whole player
 * pool so /team can show movement the API otherwise forgets. Skips writes while
 * the game is updating.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const status = await getGameStatus();
  if (status !== 'live') {
    console.log(`[cron/prices] no-op: game status ${status}`);
    return NextResponse.json({ ok: true, skipped: `game-${status}` });
  }

  const snapshot = await buildPriceSnapshot();
  await getStore().set(keys.prices(snapshot.date), snapshot);

  const movers = snapshot.rows.filter((r) => r.costChangeEvent !== 0).length;
  console.log(`[cron/prices] stored ${snapshot.date} (${movers} movers)`);
  return NextResponse.json({ ok: true, date: snapshot.date, movers });
}
