import { apiError, envelope, runRoute } from '@/lib/api';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';

export const dynamic = 'force-dynamic';

/**
 * Captaincy concentration for the last resolved gameweek. If most of the league
 * captained one player and I didn't, that single choice dominates the GW.
 *
 * This changes weekly and is only visible post-deadline, so it reads as the
 * league's *habits*, not a prediction.
 */
export function GET(_req: Request, ctx: RouteContext<'/api/leagues/[id]/captaincy'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);

    const topShare = model.captaincy[0]
      ? model.captaincy[0].count / Math.max(1, model.rivalCount)
      : 0;

    return envelope(
      {
        asOfGw: model.asOfGw,
        rivalCount: model.rivalCount,
        distribution: model.captaincy,
        mostCaptained: model.captaincy[0] ?? null,
        concentration: Math.round(topShare * 100) / 100,
        iDivergeFromCrowd:
          !!model.captaincy[0] && !model.captaincy[0].isMyCaptain && topShare >= 0.5,
      },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
