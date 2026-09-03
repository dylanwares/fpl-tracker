import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';
import { getMySquad } from '@/lib/team';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const squad = await getMySquad();
    return envelope(squad, { gameStatus, asOfGw: squad.gameweek });
  });
}
