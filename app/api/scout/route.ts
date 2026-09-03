import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';
import { getScoutData } from '@/lib/scout';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const data = await getScoutData();
    return envelope(data, { gameStatus, asOfGw: data.asOfGw });
  });
}
