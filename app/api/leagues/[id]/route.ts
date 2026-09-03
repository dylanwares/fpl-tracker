import type { NextRequest } from 'next/server';

import { envelope, apiError, runRoute } from '@/lib/api';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import { lastResolvedGameweek } from '@/lib/gameweek';
import { buildLeague } from '@/lib/league';
import { ALL_CHIPS } from '@/lib/chips';

export const dynamic = 'force-dynamic';

export function GET(_req: NextRequest, ctx: RouteContext<'/api/leagues/[id]'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    const leagueId = Number.parseInt(id, 10);
    if (!Number.isFinite(leagueId)) return apiError('Bad league id', 400);

    const gameStatus = await getGameStatus();
    const bs = normaliseBootstrap(await fetchBootstrap());
    const resolved = lastResolvedGameweek(bs);
    const asOfGw = resolved?.id ?? 1;

    const built = await buildLeague(leagueId, asOfGw);

    const rivals = built.rivals.map((r) => ({
      entryId: r.entryId,
      entryName: r.entryName,
      playerName: r.playerName,
      activeChip: r.activeChip,
      chipsUsed: r.chipsUsed,
      chipsRemaining: ALL_CHIPS.filter(
        (c) => !r.chipsUsed.some((u) => u.name === c),
      ),
      picks: r.picks
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((p) => {
          const player = bs.players.get(p.playerId);
          return {
            ...p,
            webName: player?.webName ?? `#${p.playerId}`,
            teamShort: player?.teamShort ?? '???',
            position: player?.position ?? 'MID',
          };
        }),
    }));

    return envelope(
      { league: built.league, asOfGw, rivals },
      { gameStatus, asOfGw },
    );
  });
}
