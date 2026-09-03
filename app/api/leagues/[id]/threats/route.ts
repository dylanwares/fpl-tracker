import type { NextRequest } from 'next/server';

import { apiError, envelope, runRoute } from '@/lib/api';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';
import { rivalNameMap, toRow } from '@/lib/rows';

export const dynamic = 'force-dynamic';

/**
 * Dangerous players: rivals have exposure I don't match. Restricted to
 * myEO === 0, or netEO < 0 (includes players I own but rivals have captained).
 *
 * ?sort=ownership  -> raw rivalEO ("who is everyone backing")
 * ?sort=damage     -> rivalEO x projected ("who actually hurts me this week")
 */
export function GET(req: NextRequest, ctx: RouteContext<'/api/leagues/[id]/threats'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);

    const sort = req.nextUrl.searchParams.get('sort') === 'ownership'
      ? 'ownership'
      : 'damage';

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);
    const names = rivalNameMap(model.rivals);

    const threats = model.players
      .filter((p) => p.netEO < 0 && p.rivalEO > 0)
      .map((p) => toRow(p, names))
      .sort((a, b) =>
        sort === 'ownership'
          ? b.rivalEO - a.rivalEO || b.expectedDamage - a.expectedDamage
          : b.expectedDamage - a.expectedDamage || b.rivalEO - a.rivalEO,
      );

    return envelope(
      {
        asOfGw: model.asOfGw,
        targetGw: model.targetGw,
        rivalCount: model.rivalCount,
        sort,
        rows: threats,
      },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
