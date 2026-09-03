import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';
import { getMyHistory } from '@/lib/team';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const history = await getMyHistory();
    return envelope(history, {
      gameStatus,
      asOfGw: history.at(-1)?.gameweek ?? null,
    });
  });
}
