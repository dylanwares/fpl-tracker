/**
 * Deadline diff — retrospective, not a live feed. Once a deadline passes and
 * rival picks resolve, diff them against the previous stored snapshot to show
 * every transfer the league made and each move's netEO impact. The first thing
 * worth looking at when the blackout lifts.
 */

import type { LeagueSnapshot, StoredRivalSquad } from '@/lib/store/schema';
import type { ChipName } from '@/lib/types';

export interface RivalMove {
  inId: number;
  outId: number;
  /** change in rivalEO for the incoming player, curr - prev */
  inRivalEoDelta: number;
  /** change in rivalEO for the outgoing player, curr - prev */
  outRivalEoDelta: number;
  /**
   * effect on my netEO from this swap: my exposure is unchanged, so it's the
   * negative of how much the league's exposure to these players shifted.
   */
  netEoImpact: number;
}

export interface RivalDiff {
  entryId: number;
  entryName: string;
  playerName: string;
  inIds: number[];
  outIds: number[];
  captainChange: { fromId: number | null; toId: number | null } | null;
  chipsNewlyUsed: ChipName[];
  moves: RivalMove[];
}

export interface LeagueExposureShift {
  playerId: number;
  rivalEoBefore: number;
  rivalEoAfter: number;
  delta: number;
}

export interface DeadlineDiff {
  fromGw: number;
  toGw: number;
  rivals: RivalDiff[];
  /** biggest rises in rivalEO — new/growing threats */
  rising: LeagueExposureShift[];
  /** biggest falls in rivalEO — fading threats */
  fading: LeagueExposureShift[];
}

function captainOf(sq: StoredRivalSquad): number | null {
  return sq.captainId ?? null;
}

function eo(
  snap: LeagueSnapshot,
  playerId: number,
  field: 'rivalEO' | 'myEO' | 'netEO',
): number {
  return snap.exposure[playerId]?.[field] ?? 0;
}

export function deadlineDiff(
  prev: LeagueSnapshot,
  curr: LeagueSnapshot,
): DeadlineDiff {
  const prevByEntry = new Map(prev.rivals.map((r) => [r.entryId, r]));

  const rivals: RivalDiff[] = curr.rivals.map((now) => {
    const before = prevByEntry.get(now.entryId);
    const beforeIds = new Set(before?.picks.map((p) => p.playerId) ?? []);
    const nowIds = new Set(now.picks.map((p) => p.playerId));

    const inIds = [...nowIds].filter((x) => !beforeIds.has(x));
    const outIds = [...beforeIds].filter((x) => !nowIds.has(x));

    const beforeChips = new Set(
      before?.chipsUsed.map((c) => `${c.name}:${c.event}`) ?? [],
    );
    const chipsNewlyUsed = now.chipsUsed
      .filter((c) => !beforeChips.has(`${c.name}:${c.event}`))
      .map((c) => c.name);

    const capBefore = before ? captainOf(before) : null;
    const capNow = captainOf(now);
    const captainChange =
      capBefore !== capNow ? { fromId: capBefore, toId: capNow } : null;

    // Pair ins and outs positionally — good enough for display.
    const moves: RivalMove[] = inIds.map((inId, i) => {
      const outId = outIds[i] ?? 0;
      const inDelta = eo(curr, inId, 'rivalEO') - eo(prev, inId, 'rivalEO');
      const outDelta = eo(curr, outId, 'rivalEO') - eo(prev, outId, 'rivalEO');
      return {
        inId,
        outId,
        inRivalEoDelta: round(inDelta),
        outRivalEoDelta: round(outDelta),
        netEoImpact: round(-(inDelta + outDelta)),
      };
    });

    return {
      entryId: now.entryId,
      entryName: now.entryName,
      playerName: now.playerName,
      inIds,
      outIds,
      captainChange,
      chipsNewlyUsed,
      moves,
    };
  });

  // League-wide exposure shifts.
  const playerIds = new Set<number>([
    ...Object.keys(prev.exposure).map(Number),
    ...Object.keys(curr.exposure).map(Number),
  ]);
  const shifts: LeagueExposureShift[] = [...playerIds].map((playerId) => {
    const rivalEoBefore = eo(prev, playerId, 'rivalEO');
    const rivalEoAfter = eo(curr, playerId, 'rivalEO');
    return {
      playerId,
      rivalEoBefore: round(rivalEoBefore),
      rivalEoAfter: round(rivalEoAfter),
      delta: round(rivalEoAfter - rivalEoBefore),
    };
  });

  const rising = shifts
    .filter((s) => s.delta > 0.001)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 8);
  const fading = shifts
    .filter((s) => s.delta < -0.001)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 8);

  return { fromGw: prev.gw, toGw: curr.gw, rivals, rising, fading };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
