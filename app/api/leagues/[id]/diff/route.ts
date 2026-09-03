import { apiError, envelope, runRoute } from '@/lib/api';
import { deadlineDiff } from '@/lib/diff';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import { latestLeagueSnapshots } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * What the league changed at the last deadline. Computed from the two most
 * recent stored snapshots — needs the snapshot cron to have run at least twice.
 */
export function GET(_req: Request, ctx: RouteContext<'/api/leagues/[id]/diff'>) {
  return runRoute(async () => {
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) return apiError('Bad league id', 400);
    const leagueId = Number.parseInt(id, 10);

    const gameStatus = await getGameStatus();
    const snaps = await latestLeagueSnapshots(leagueId, 2);

    if (snaps.length < 2) {
      return envelope(
        {
          available: false,
          reason:
            'Need at least two stored gameweek snapshots. The snapshot cron runs after each gameweek settles.',
          have: snaps.map((s) => s.gw),
        },
        { gameStatus, asOfGw: snaps[0]?.gw ?? null },
      );
    }

    const [curr, prev] = snaps; // latest first
    const diff = deadlineDiff(prev, curr);

    // Attach names for the UI.
    const bs = normaliseBootstrap(await fetchBootstrap());
    const name = (pid: number) => bs.players.get(pid)?.webName ?? `#${pid}`;
    const label = <T extends { playerId: number }>(rows: T[]) =>
      rows.map((r) => ({ ...r, webName: name(r.playerId) }));

    return envelope(
      {
        available: true,
        fromGw: diff.fromGw,
        toGw: diff.toGw,
        rivals: diff.rivals.map((r) => ({
          ...r,
          ins: r.inIds.map((pid) => ({ playerId: pid, webName: name(pid) })),
          outs: r.outIds.map((pid) => ({ playerId: pid, webName: name(pid) })),
          moves: r.moves.map((m) => ({
            ...m,
            inName: name(m.inId),
            outName: m.outId ? name(m.outId) : null,
          })),
          captainChange: r.captainChange
            ? {
                fromName: r.captainChange.fromId ? name(r.captainChange.fromId) : null,
                toName: r.captainChange.toId ? name(r.captainChange.toId) : null,
                ...r.captainChange,
              }
            : null,
        })),
        rising: label(diff.rising),
        fading: label(diff.fading),
      },
      { gameStatus, asOfGw: diff.toGw },
    );
  });
}
