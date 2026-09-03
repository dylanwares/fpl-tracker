import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    return envelope({ gameStatus }, { gameStatus });
  });
}
