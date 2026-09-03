import { getTeamAnalysis } from '@/lib/analysis';
import { envelope, runRoute } from '@/lib/api';
import { getGameStatus } from '@/lib/fpl/status';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const analysis = await getTeamAnalysis();
    return envelope(analysis, { gameStatus, asOfGw: analysis.asOfGw });
  });
}
