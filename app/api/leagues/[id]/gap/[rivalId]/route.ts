import { apiError, envelope, runRoute } from '@/lib/api';
import { netEoVsRival } from '@/lib/exposure';
import { getExposureModel } from '@/lib/exposure-model';
import { getGameStatus } from '@/lib/fpl/status';

export const dynamic = 'force-dynamic';

/**
 * Head-to-head against one rival: the swing available this gameweek is the sum
 * of swing(p) computed against that single rival rather than the whole league.
 * Surface the two or three players who most determine the outcome, and the
 * points gap to close.
 */
export function GET(
  _req: Request,
  ctx: RouteContext<'/api/leagues/[id]/gap/[rivalId]'>,
) {
  return runRoute(async () => {
    const { id, rivalId } = await ctx.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(rivalId)) {
      return apiError('Bad id', 400);
    }
    const rivalEntryId = Number.parseInt(rivalId, 10);

    const gameStatus = await getGameStatus();
    const model = await getExposureModel(id);

    const rival = model.rivalsFull.find((r) => r.entryId === rivalEntryId);
    if (!rival) return apiError('Rival not in this league', 404);

    const rivalSquad = {
      entryId: rival.entryId,
      picks: rival.picks,
      activeChip: rival.activeChip,
    };

    const contributions = model.players
      .map((p) => {
        const net = netEoVsRival(p.playerId, model.mine, rivalSquad);
        return {
          playerId: p.playerId,
          webName: p.player.webName,
          teamShort: p.player.teamShort,
          fixtureLabel: p.fixtureLabel,
          netEoVsRival: Math.round(net * 100) / 100,
          projectedPoints: p.projectedPoints,
          swing: Math.round(net * p.projectedPoints * 100) / 100,
        };
      })
      .filter((c) => c.netEoVsRival !== 0)
      .sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));

    const expectedSwing =
      Math.round(contributions.reduce((s, c) => s + c.swing, 0) * 100) / 100;

    const myStanding = model.standings.find((s) => s.entryId === model.myEntryId);
    const rivalStanding = model.standings.find((s) => s.entryId === rivalEntryId);
    const pointsGap =
      myStanding && rivalStanding
        ? rivalStanding.total - myStanding.total
        : null;

    return envelope(
      {
        asOfGw: model.asOfGw,
        targetGw: model.targetGw,
        rival: {
          entryId: rival.entryId,
          entryName: rival.entryName,
          playerName: rival.playerName,
          rank: rivalStanding?.rank ?? null,
          total: rivalStanding?.total ?? null,
        },
        /** rival total minus mine: positive = they're ahead by this much */
        pointsGap,
        expectedSwing,
        decisive: contributions.slice(0, 3),
        contributions,
      },
      { gameStatus, asOfGw: model.asOfGw },
    );
  });
}
