import { apiError, envelope, runRoute } from '@/lib/api';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';
import { rivalNameMap, toRow } from '@/lib/rows';

export const dynamic = 'force-dynamic';

export function GET(_req: Request, ctx: RouteContext<'/api/leagues/[id]/exposure'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);
    const names = rivalNameMap(model.rivals);

    const rows = model.players
      .map((p) => toRow(p, names))
      .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));

    return envelope(
      {
        asOfGw: model.asOfGw,
        targetGw: model.targetGw,
        rivalCount: model.rivalCount,
        rivals: model.rivals,
        expectedSwingTotal: model.expectedSwingTotal,
        rows,
      },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
