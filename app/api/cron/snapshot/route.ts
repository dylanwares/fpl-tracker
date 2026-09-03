import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { checkCronAuth } from '@/lib/cron';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import { buildLeagueSnapshot, resolvedGameweekToSnapshot } from '@/lib/snapshot';
import { getStore, keys, readLeagueSnapshot } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Runs ~23:00 UK on Mondays, after the gameweek settles (bonus, auto-subs and
 * final standings take an hour or two after the last whistle). Captures
 * standings, resolved rival picks + captains, and resolved exposure.
 *
 * Never writes while the game is updating — a partial snapshot is worse than a
 * missing one, because next week's diff is computed against it.
 */
export async function GET(req: Request) {
  const auth = checkCronAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const status = await getGameStatus();
  if (status !== 'live') {
    console.log(`[cron/snapshot] no-op: game status ${status}`);
    return NextResponse.json({ ok: true, skipped: `game-${status}` });
  }

  const { primaryLeagueId } = getConfig();
  const bs = normaliseBootstrap(await fetchBootstrap());
  const gw = resolvedGameweekToSnapshot(bs.events);

  if (!gw) {
    return NextResponse.json({ ok: true, skipped: 'no-resolved-gameweek' });
  }

  const existing = await readLeagueSnapshot(primaryLeagueId, gw);
  if (existing) {
    return NextResponse.json({ ok: true, skipped: 'already-snapshotted', gw });
  }

  const snapshot = await buildLeagueSnapshot(primaryLeagueId, gw);
  await getStore().set(keys.leagueSnapshot(primaryLeagueId, gw), snapshot);

  console.log(
    `[cron/snapshot] stored league ${primaryLeagueId} gw ${gw} ` +
      `(${snapshot.rivals.length} rivals)`,
  );
  return NextResponse.json({
    ok: true,
    gw,
    leagueId: primaryLeagueId,
    rivals: snapshot.rivals.length,
  });
}
