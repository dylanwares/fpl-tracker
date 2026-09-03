/**
 * Shapes persisted to the store. Kept separate from lib/types.ts because these
 * are storage records with their own versioning concerns, not domain types.
 */

import type { AutomaticSub, ChipName, LeagueStanding, Pick } from '@/lib/types';
import type { ExposureRow } from '@/lib/exposure';

export interface StoredRivalSquad {
  entryId: number;
  entryName: string;
  playerName: string;
  picks: Pick[];
  automaticSubs: AutomaticSub[];
  activeChip: ChipName | null;
  captainId: number | null;
  chipsUsed: { name: ChipName; event: number }[];
}

export interface LeagueSnapshot {
  version: 1;
  leagueId: number;
  gw: number;
  takenAt: string; // ISO
  standings: LeagueStanding[];
  /** my resolved squad for this GW */
  mine: { picks: Pick[]; automaticSubs: AutomaticSub[]; activeChip: ChipName | null };
  rivals: StoredRivalSquad[];
  /** resolved exposure at snapshot time, keyed by playerId */
  exposure: Record<number, ExposureRow>;
}

export interface PriceRow {
  id: number;
  webName: string;
  nowCost: number; // millions
  costChangeEvent: number; // millions, net this GW
}

export interface PriceSnapshot {
  version: 1;
  date: string; // YYYY-MM-DD
  takenAt: string; // ISO
  rows: PriceRow[];
}
