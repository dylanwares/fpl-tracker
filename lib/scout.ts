/**
 * Scout view — squad performance, a value leaderboard, and a template
 * comparison, all from bootstrap-static.
 *
 * This is deliberately an *overall-game* view, kept separate from the
 * league-relative threat/differential tables. "Template" here is the
 * spec's bootstrap approximation: the most-selected valid squad by
 * `selectedByPercent`, since real top-10k data isn't public.
 */

import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getMySquad } from '@/lib/team';
import type { Player, Position } from '@/lib/types';

export interface ScoutPlayer {
  id: number;
  webName: string;
  teamShort: string;
  position: Position;
  price: number;
  totalPoints: number;
  eventPoints: number;
  form: number;
  pointsPerGame: number;
  selectedByPercent: number;
  minutes: number;
  priceChangeEvent: number;
  /** total points per £m of current price */
  pointsPerMillion: number;
  iOwn: boolean;
  inMyXi: boolean;
}

export interface TemplateComparison {
  /** most-selected valid XI */
  xi: ScoutPlayer[];
  /** most-selected valid 15 */
  squad: ScoutPlayer[];
  /** count of my starting XI that also appears in the template XI */
  xiOverlap: number;
  /** 0-1: xiOverlap / 11 */
  xiDistance: number;
  /** template XI players I don't own */
  missing: ScoutPlayer[];
  /** my starting XI players that aren't in the template XI */
  offTemplate: ScoutPlayer[];
}

export interface ScoutData {
  asOfGw: number;
  mySquad: {
    entryName: string;
    starters: ScoutPlayer[];
    bench: ScoutPlayer[];
    all: ScoutPlayer[];
  };
  template: TemplateComparison;
  /** whole pool, sorted by pointsPerMillion desc; page filters client-side */
  pool: ScoutPlayer[];
}

const XI_MIN: Record<Position, number> = { GKP: 1, DEF: 3, MID: 2, FWD: 1 };
const XI_MAX: Record<Position, number> = { GKP: 1, DEF: 5, MID: 5, FWD: 3 };
const SQUAD_COUNT: Record<Position, number> = { GKP: 2, DEF: 5, MID: 5, FWD: 3 };

function toScout(
  p: Player,
  ownedIds: Set<number>,
  xiIds: Set<number>,
): ScoutPlayer {
  return {
    id: p.id,
    webName: p.webName,
    teamShort: p.teamShort,
    position: p.position,
    price: p.price,
    totalPoints: p.totalPoints,
    eventPoints: p.eventPoints,
    form: p.form,
    pointsPerGame: p.pointsPerGame,
    selectedByPercent: p.selectedByPercent,
    minutes: p.minutes,
    priceChangeEvent: p.priceChangeEvent,
    pointsPerMillion:
      p.price > 0 ? Math.round((p.totalPoints / p.price) * 10) / 10 : 0,
    iOwn: ownedIds.has(p.id),
    inMyXi: xiIds.has(p.id),
  };
}

/** Most-selected valid 15: top N by ownership at each position. */
function templateSquad(byOwnership: Player[]): Player[] {
  const out: Player[] = [];
  for (const pos of ['GKP', 'DEF', 'MID', 'FWD'] as Position[]) {
    out.push(
      ...byOwnership.filter((p) => p.position === pos).slice(0, SQUAD_COUNT[pos]),
    );
  }
  return out;
}

/** Most-selected valid XI: fill each position to its minimum by ownership,
 *  then add the remaining slots with the highest-owned players still allowed. */
function templateXi(byOwnership: Player[]): Player[] {
  const counts: Record<Position, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  const picked = new Set<number>();
  const out: Player[] = [];

  const take = (p: Player) => {
    picked.add(p.id);
    counts[p.position] += 1;
    out.push(p);
  };

  for (const pos of ['GKP', 'DEF', 'MID', 'FWD'] as Position[]) {
    for (const p of byOwnership) {
      if (counts[pos] >= XI_MIN[pos]) break;
      if (p.position === pos && !picked.has(p.id)) take(p);
    }
  }
  for (const p of byOwnership) {
    if (out.length >= 11) break;
    if (picked.has(p.id)) continue;
    if (counts[p.position] < XI_MAX[p.position]) take(p);
  }

  // Present in a sensible order: GKP, DEF, MID, FWD, then by ownership.
  const order: Position[] = ['GKP', 'DEF', 'MID', 'FWD'];
  return out.sort(
    (a, b) =>
      order.indexOf(a.position) - order.indexOf(b.position) ||
      b.selectedByPercent - a.selectedByPercent,
  );
}

export async function getScoutData(): Promise<ScoutData> {
  const [rawBootstrap, squad] = await Promise.all([
    fetchBootstrap(),
    getMySquad(),
  ]);
  const bs = normaliseBootstrap(rawBootstrap);
  const players = [...bs.players.values()];
  const byOwnership = [...players].sort(
    (a, b) => b.selectedByPercent - a.selectedByPercent,
  );

  const ownedIds = new Set(squad.slots.map((s) => s.player.id));
  const xiIds = new Set(
    squad.slots.filter((s) => s.pick.multiplier >= 1).map((s) => s.player.id),
  );

  const tXiPlayers = templateXi(byOwnership);
  const tSquadPlayers = templateSquad(byOwnership);
  const tXiIds = new Set(tXiPlayers.map((p) => p.id));

  const scout = (p: Player) => toScout(p, ownedIds, xiIds);

  const templateXiScout = tXiPlayers.map(scout);
  const missing = templateXiScout.filter((p) => !p.iOwn);
  const offTemplate = squad.slots
    .filter((s) => s.pick.multiplier >= 1 && !tXiIds.has(s.player.id))
    .map((s) => scout(s.player));
  const xiOverlap = 11 - missing.length;

  const allMine = squad.slots.map((s) => scout(s.player));

  return {
    asOfGw: squad.gameweek,
    mySquad: {
      entryName: squad.entry.entryName,
      starters: allMine.filter((p) => p.inMyXi),
      bench: allMine.filter((p) => !p.inMyXi),
      all: allMine,
    },
    template: {
      xi: templateXiScout,
      squad: tSquadPlayers.map(scout),
      xiOverlap,
      xiDistance: Math.round((xiOverlap / 11) * 100) / 100,
      missing,
      offTemplate,
    },
    // Trim the pool sent to the client: players who've featured, best value
    // first, capped well past what any filter combination surfaces.
    pool: [...players]
      .filter((p) => p.minutes > 0)
      .map(scout)
      .sort((a, b) => b.pointsPerMillion - a.pointsPerMillion)
      .slice(0, 300),
  };
}
