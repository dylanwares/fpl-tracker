/**
 * Exposure — the shared primitive (spec section 4).
 *
 * Threats and differentials are the same calculation with opposite signs.
 * Compute exposure once, derive both views from it.
 *
 * For a player p and an entry e, exposure is that entry's scoring multiplier:
 *   0  not owned, or on the bench
 *   1  in the starting XI
 *   2  captained
 *   3  triple-captained
 * Bench Boost weeks are the exception: every one of the 15 counts as at least 1.
 *
 * Across the N rival entries (everyone except me):
 *   rivalEO(p) = sum exposure(p, e) / N        // 0..3, usually 0..1.2
 *   myEO(p)    = exposure(p, me)               // 0, 1, 2 or 3
 *   netEO(p)   = myEO(p) - rivalEO(p)
 *
 * netEO < 0  -> a threat   (every point this player scores costs me ground)
 * netEO > 0  -> a differential (every point gains me ground)
 * netEO ~ 0  -> irrelevant to the league
 */

import type { ChipName, Pick } from '@/lib/types';

const clamp3 = (n: number) => Math.max(0, Math.min(3, n));

export function exposure(
  pick: Pick | undefined,
  opts: { benchBoost: boolean },
): 0 | 1 | 2 | 3 {
  if (!pick) return 0;
  let m = pick.multiplier;
  if (opts.benchBoost && m === 0) m = 1;
  return clamp3(m) as 0 | 1 | 2 | 3;
}

export interface EntrySquad {
  entryId: number;
  picks: Pick[];
  activeChip: ChipName | null;
}

export interface ExposureRow {
  playerId: number;
  myEO: number;
  rivalEO: number;
  netEO: number;
  /** how many rivals have any exposure (starting or captained) */
  rivalOwnerCount: number;
  rivalOwnerIds: number[];
  /** how many rivals captained (or triple-captained) him */
  rivalCaptainCount: number;
  iOwn: boolean;
  iCaptain: boolean;
}

function pickMap(picks: Pick[]): Map<number, Pick> {
  const m = new Map<number, Pick>();
  for (const p of picks) m.set(p.playerId, p);
  return m;
}

export function computeExposure(
  mine: { picks: Pick[]; activeChip: ChipName | null },
  rivals: EntrySquad[],
): Map<number, ExposureRow> {
  const n = rivals.length;
  const myBench = mine.activeChip === 'bboost';
  const myPicks = pickMap(mine.picks);
  const rivalPickMaps = rivals.map((r) => ({
    entryId: r.entryId,
    benchBoost: r.activeChip === 'bboost',
    picks: pickMap(r.picks),
  }));

  const playerIds = new Set<number>();
  for (const p of mine.picks) playerIds.add(p.playerId);
  for (const r of rivals) for (const p of r.picks) playerIds.add(p.playerId);

  const rows = new Map<number, ExposureRow>();
  for (const playerId of playerIds) {
    const myPick = myPicks.get(playerId);
    const myEO = exposure(myPick, { benchBoost: myBench });

    let rivalTotal = 0;
    let rivalCaptainCount = 0;
    const rivalOwnerIds: number[] = [];
    for (const r of rivalPickMaps) {
      const rp = r.picks.get(playerId);
      const eo = exposure(rp, { benchBoost: r.benchBoost });
      if (eo > 0) {
        rivalTotal += eo;
        rivalOwnerIds.push(r.entryId);
        if (eo >= 2) rivalCaptainCount += 1;
      }
    }
    const rivalEO = n > 0 ? rivalTotal / n : 0;

    rows.set(playerId, {
      playerId,
      myEO,
      rivalEO,
      netEO: myEO - rivalEO,
      rivalOwnerCount: rivalOwnerIds.length,
      rivalOwnerIds,
      rivalCaptainCount,
      iOwn: myEO > 0,
      iCaptain: myPick?.isCaptain ?? false,
    });
  }
  return rows;
}

/** Expected rank swing for the gameweek: netEO x projectedPoints. */
export function swing(netEO: number, projectedPoints: number): number {
  return netEO * projectedPoints;
}

/**
 * netEO against a single rival rather than the whole league. Used for
 * head-to-head gap analysis.
 */
export function netEoVsRival(
  playerId: number,
  mine: { picks: Pick[]; activeChip: ChipName | null },
  rival: EntrySquad,
): number {
  const myPick = mine.picks.find((p) => p.playerId === playerId);
  const rivalPick = rival.picks.find((p) => p.playerId === playerId);
  const myEO = exposure(myPick, { benchBoost: mine.activeChip === 'bboost' });
  const rivalEO = exposure(rivalPick, {
    benchBoost: rival.activeChip === 'bboost',
  });
  return myEO - rivalEO;
}
