import { apiError, envelope, runRoute } from '@/lib/api';
import { ALL_CHIPS } from '@/lib/chips';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';

export const dynamic = 'force-dynamic';

/**
 * Chips remaining per rival, from each rival's history payload. A rival with
 * Bench Boost or Triple Captain still in hand changes what a sensible move
 * looks like for me. A chip played for the current GW only shows up here once
 * that deadline has passed.
 */
export function GET(_req: Request, ctx: RouteContext<'/api/leagues/[id]/chips'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);

    const rivals = model.rivalsFull.map((r) => {
      const usedNames = new Set(r.chipsUsed.map((c) => c.name));
      return {
        entryId: r.entryId,
        entryName: r.entryName,
        playerName: r.playerName,
        used: r.chipsUsed,
        remaining: ALL_CHIPS.filter((c) => !usedNames.has(c)),
      };
    });

    return envelope(
      { asOfGw: model.asOfGw, rivals },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
