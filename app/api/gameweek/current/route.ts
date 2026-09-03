import { envelope, runRoute } from '@/lib/api';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import {
  currentGameweek,
  lastResolvedGameweek,
  nextGameweek,
} from '@/lib/gameweek';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const bs = normaliseBootstrap(await fetchBootstrap());

    const current = currentGameweek(bs);
    const next = nextGameweek(bs);
    const resolved = lastResolvedGameweek(bs);

    return envelope(
      {
        current,
        next,
        resolved,
        // The countdown target: the next deadline that hasn't passed.
        deadline: next?.deadline ?? current?.deadline ?? null,
        deadlineEpoch: next?.deadlineEpoch ?? current?.deadlineEpoch ?? null,
        averageEntryScore: current?.averageEntryScore ?? null,
      },
      { gameStatus, asOfGw: resolved?.id ?? current?.id ?? null },
    );
  });
}
