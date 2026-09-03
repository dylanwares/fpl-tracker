import { apiError, envelope, runRoute } from '@/lib/api';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';
import { rivalNameMap, toRow } from '@/lib/rows';

export const dynamic = 'force-dynamic';

/**
 * My differentials: players I own that the league mostly doesn't, ranked by
 * netEO x projected. Plus negative differentials — players in my XI that most
 * of the league also owns/captains, which keep me level rather than gaining.
 *
 * Global ownership is deliberately never included: a differential is only a
 * differential *in this league*.
 */
export function GET(_req: Request, ctx: RouteContext<'/api/leagues/[id]/differentials'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);
    const n = model.rivalCount;
    const names = rivalNameMap(model.rivals);

    const mine = model.players.filter((p) => p.myEO > 0);

    const differentials = mine
      .filter((p) => p.netEO > 0)
      .map((p) => toRow(p, names))
      .sort((a, b) => b.swing - a.swing);

    // "most of the league also owns him" — held by over half the rivals.
    const negativeDifferentials = mine
      .filter((p) => p.netEO <= 0 && p.rivalOwnerCount >= Math.ceil(n / 2))
      .map((p) => toRow(p, names))
      .sort((a, b) => a.netEO - b.netEO);

    return envelope(
      {
        asOfGw: model.asOfGw,
        targetGw: model.targetGw,
        rivalCount: n,
        differentials,
        negativeDifferentials,
      },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
