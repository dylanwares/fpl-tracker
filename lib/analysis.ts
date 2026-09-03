/**
 * "Luck vs decisions" — the /analysis numbers. Defined precisely because they
 * are easy to get subtly wrong (spec section 4).
 *
 * Per-gameweek player points come from /element-summary/{id}/ history rows
 * keyed by `round`; there is no live endpoint in scope. Only the ~20-40 players
 * that pass through my squad or transfers are fetched.
 */

import { getConfig } from '@/lib/config';
import { mapLimit } from '@/lib/concurrency';
import {
  fetchBootstrap,
  fetchElementSummary,
  fetchEntryHistory,
  fetchEntryPicks,
  fetchEntryTransfers,
} from '@/lib/fpl/endpoints';
import {
  normaliseBootstrap,
  normaliseChipName,
  normaliseHistory,
  normalisePick,
  normaliseTransfer,
} from '@/lib/fpl/normalise';
import type { ChipName } from '@/lib/types';

const WC_FH: ChipName[] = ['wildcard', 'freehit'];

export interface GwCaptaincy {
  gameweek: number;
  captainId: number;
  captainName: string;
  captainRaw: number;
  bestRaw: number;
  bestId: number;
  bestName: string;
  loss: number;
  viceOutscoredCaptain: boolean;
  armbandOnTopScorer: boolean;
}

export interface GwBench {
  gameweek: number;
  benchBoost: boolean;
  wastedPoints: number;
  players: { id: number; name: string; points: number }[];
}

export interface GwTransferRoi {
  gameweek: number;
  chip: ChipName | null;
  moves: {
    inId: number;
    inName: string;
    outId: number;
    outName: string;
    inPoints: number;
    outPoints: number;
    roi: number;
    windowGws: number;
  }[];
  grossRoi: number;
  hit: number;
  netRoi: number;
}

export interface PointsVsAverage {
  gameweek: number;
  points: number;
  average: number;
  delta: number;
  cumulativeDelta: number;
}

export interface TeamAnalysis {
  asOfGw: number;
  captaincy: {
    perGw: GwCaptaincy[];
    totalLoss: number;
    viceOutscoredCount: number;
    armbandOnTopCount: number;
  };
  bench: {
    perGw: GwBench[];
    totalWasted: number;
  };
  transfers: {
    perGw: GwTransferRoi[];
    /** excludes wildcard / free-hit gameweeks */
    seasonNetRoi: number;
    seasonGrossRoi: number;
  };
  hits: {
    total: number;
    perGw: { gameweek: number; cost: number }[];
  };
  pointsVsAverage: PointsVsAverage[];
}

/** playerId -> (round -> summed points that round) */
type PointsIndex = Map<number, Map<number, number>>;

function pointsIn(
  index: PointsIndex,
  playerId: number,
  fromGw: number,
  toGw: number,
): number {
  const rounds = index.get(playerId);
  if (!rounds) return 0;
  let total = 0;
  for (let gw = fromGw; gw <= toGw; gw++) total += rounds.get(gw) ?? 0;
  return total;
}

export async function getTeamAnalysis(): Promise<TeamAnalysis> {
  const { entryId } = getConfig();
  const [rawBootstrap, rawHistory, rawTransfers] = await Promise.all([
    fetchBootstrap(),
    fetchEntryHistory(entryId),
    fetchEntryTransfers(entryId),
  ]);

  const bs = normaliseBootstrap(rawBootstrap);
  const history = normaliseHistory(rawHistory);
  const transfers = rawTransfers.map(normaliseTransfer);

  const playedGws = history.map((h) => h.gameweek).sort((a, b) => a - b);
  const asOfGw = playedGws.at(-1) ?? 0;
  if (asOfGw === 0) {
    return emptyAnalysis();
  }

  // Fetch my picks for every played gameweek.
  const picksByGw = new Map<
    number,
    Awaited<ReturnType<typeof fetchEntryPicks>>
  >();
  await mapLimit(playedGws, 5, async (gw) => {
    picksByGw.set(gw, await fetchEntryPicks(entryId, gw));
  });

  // Every player that matters: anyone I've picked, plus transfer in/out.
  const relevant = new Set<number>();
  for (const res of picksByGw.values()) {
    for (const p of res.picks ?? []) relevant.add(p.element);
  }
  for (const t of transfers) {
    relevant.add(t.inPlayerId);
    relevant.add(t.outPlayerId);
  }

  const index: PointsIndex = new Map();
  await mapLimit([...relevant], 5, async (playerId) => {
    const summary = await fetchElementSummary(playerId);
    const rounds = new Map<number, number>();
    for (const row of summary.history ?? []) {
      rounds.set(row.round, (rounds.get(row.round) ?? 0) + (row.total_points ?? 0));
    }
    index.set(playerId, rounds);
  });

  const name = (id: number) => bs.players.get(id)?.webName ?? `#${id}`;

  // ---- captaincy + bench, per gameweek ----
  const capPerGw: GwCaptaincy[] = [];
  const benchPerGw: GwBench[] = [];

  for (const gw of playedGws) {
    const res = picksByGw.get(gw);
    if (!res) continue;
    const picks = (res.picks ?? []).map(normalisePick);
    const activeChip = normaliseChipName(res.active_chip);
    const subs = res.automatic_subs ?? [];
    const subbedInIds = new Set(subs.map((s) => s.element_in));
    const subbedOutIds = new Set(subs.map((s) => s.element_out));

    const raw = (id: number) => pointsIn(index, id, gw, gw);

    // Effective starting XI after auto-subs.
    const started = picks.filter(
      (p) =>
        (p.multiplier >= 1 && !subbedOutIds.has(p.playerId)) ||
        subbedInIds.has(p.playerId),
    );

    // --- captaincy ---
    const capPick = picks.find((p) => p.isCaptain);
    const vicePick = picks.find((p) => p.isViceCaptain);
    let effectiveCapId = capPick?.playerId ?? 0;
    if (capPick && subbedOutIds.has(capPick.playerId) && vicePick) {
      effectiveCapId = vicePick.playerId;
    }
    const captainRaw = raw(effectiveCapId);
    let bestRaw = -Infinity;
    let bestId = effectiveCapId;
    for (const p of started) {
      const r = raw(p.playerId);
      if (r > bestRaw) {
        bestRaw = r;
        bestId = p.playerId;
      }
    }
    if (!Number.isFinite(bestRaw)) bestRaw = captainRaw;

    capPerGw.push({
      gameweek: gw,
      captainId: effectiveCapId,
      captainName: name(effectiveCapId),
      captainRaw,
      bestRaw,
      bestId,
      bestName: name(bestId),
      loss: Math.max(0, bestRaw - captainRaw),
      viceOutscoredCaptain: vicePick
        ? raw(vicePick.playerId) > captainRaw
        : false,
      armbandOnTopScorer: bestRaw === captainRaw,
    });

    // --- bench ---
    const benchBoost = activeChip === 'bboost';
    const effectiveBench = benchBoost
      ? []
      : picks.filter(
          (p) =>
            (p.multiplier === 0 && !subbedInIds.has(p.playerId)) ||
            subbedOutIds.has(p.playerId),
        );
    const benchPlayers = effectiveBench.map((p) => ({
      id: p.playerId,
      name: name(p.playerId),
      points: raw(p.playerId),
    }));
    benchPerGw.push({
      gameweek: gw,
      benchBoost,
      wastedPoints: benchPlayers.reduce((s, b) => s + b.points, 0),
      players: benchPlayers,
    });
  }

  // ---- transfer ROI, per gameweek ----
  const chipByGw = new Map<number, ChipName | null>();
  for (const h of history) chipByGw.set(h.gameweek, h.chip);

  const transfersByGw = new Map<number, typeof transfers>();
  for (const t of transfers) {
    const list = transfersByGw.get(t.gameweek) ?? [];
    list.push(t);
    transfersByGw.set(t.gameweek, list);
  }
  // When each incoming player was later sold, to bound the ROI window.
  const soldAt = new Map<number, number>();
  for (const t of transfers) {
    const prev = soldAt.get(t.outPlayerId);
    if (prev === undefined || t.gameweek < prev) {
      soldAt.set(t.outPlayerId, t.gameweek);
    }
  }

  const roiPerGw: GwTransferRoi[] = [];
  let seasonGross = 0;
  let seasonNet = 0;

  for (const gw of [...transfersByGw.keys()].sort((a, b) => a - b)) {
    const chip = chipByGw.get(gw) ?? null;
    const moves = (transfersByGw.get(gw) ?? []).map((t) => {
      const sell = soldAt.get(t.inPlayerId);
      const windowEnd = sell && sell > gw ? sell - 1 : asOfGw;
      const inPoints = pointsIn(index, t.inPlayerId, gw, windowEnd);
      const outPoints = pointsIn(index, t.outPlayerId, gw, windowEnd);
      return {
        inId: t.inPlayerId,
        inName: name(t.inPlayerId),
        outId: t.outPlayerId,
        outName: name(t.outPlayerId),
        inPoints,
        outPoints,
        roi: inPoints - outPoints,
        windowGws: windowEnd - gw + 1,
      };
    });
    const grossRoi = moves.reduce((s, m) => s + m.roi, 0);
    const hit =
      history.find((h) => h.gameweek === gw)?.transferCost ?? 0;
    const netRoi = grossRoi - hit;
    roiPerGw.push({ gameweek: gw, chip, moves, grossRoi, hit, netRoi });

    if (!WC_FH.includes(chip ?? ('' as ChipName))) {
      seasonGross += grossRoi;
      seasonNet += netRoi;
    }
  }

  // ---- hits ----
  const hitsPerGw = history
    .filter((h) => h.transferCost > 0)
    .map((h) => ({ gameweek: h.gameweek, cost: h.transferCost }));
  const hitsTotal = hitsPerGw.reduce((s, h) => s + h.cost, 0);

  // ---- points vs average ----
  const avgByGw = new Map<number, number>();
  for (const e of bs.events) avgByGw.set(e.id, e.averageEntryScore);
  let cumulative = 0;
  const pointsVsAverage: PointsVsAverage[] = history.map((h) => {
    const average = avgByGw.get(h.gameweek) ?? 0;
    const delta = h.points - average;
    cumulative += delta;
    return {
      gameweek: h.gameweek,
      points: h.points,
      average,
      delta,
      cumulativeDelta: Math.round(cumulative * 10) / 10,
    };
  });

  return {
    asOfGw,
    captaincy: {
      perGw: capPerGw,
      totalLoss: capPerGw.reduce((s, c) => s + c.loss, 0),
      viceOutscoredCount: capPerGw.filter((c) => c.viceOutscoredCaptain).length,
      armbandOnTopCount: capPerGw.filter((c) => c.armbandOnTopScorer).length,
    },
    bench: {
      perGw: benchPerGw,
      totalWasted: benchPerGw.reduce((s, b) => s + b.wastedPoints, 0),
    },
    transfers: {
      perGw: roiPerGw,
      seasonNetRoi: Math.round(seasonNet * 10) / 10,
      seasonGrossRoi: Math.round(seasonGross * 10) / 10,
    },
    hits: { total: hitsTotal, perGw: hitsPerGw },
    pointsVsAverage,
  };
}

function emptyAnalysis(): TeamAnalysis {
  return {
    asOfGw: 0,
    captaincy: {
      perGw: [],
      totalLoss: 0,
      viceOutscoredCount: 0,
      armbandOnTopCount: 0,
    },
    bench: { perGw: [], totalWasted: 0 },
    transfers: { perGw: [], seasonNetRoi: 0, seasonGrossRoi: 0 },
    hits: { total: 0, perGw: [] },
    pointsVsAverage: [],
  };
}
