/**
 * Domain model. Upstream FPL shapes are normalised into these at the fetch
 * boundary (see lib/fpl/normalise.ts). Components and derived-metric code only
 * ever see these types, never raw upstream JSON.
 */

export type Position = 'GKP' | 'DEF' | 'MID' | 'FWD';

/** available / doubtful / injured / suspended / unavailable / not-in-squad */
export type PlayerStatus = 'a' | 'd' | 'i' | 's' | 'u' | 'n';

export type ChipName = 'wildcard' | 'freehit' | 'bboost' | '3xc' | (string & {});

export interface Player {
  id: number;
  webName: string;
  fullName: string;
  teamId: number;
  teamShort: string;
  position: Position;
  /** in millions, e.g. 8.5 (upstream stores tenths) */
  price: number;
  totalPoints: number;
  form: number;
  pointsPerGame: number;
  selectedByPercent: number;
  xG: number;
  xA: number;
  xGI90: number;
  expectedGoalsConceded: number;
  status: PlayerStatus;
  /** 0-100, or null when upstream gives nothing */
  chanceOfPlaying: number | null;
  news: string;
  /** net price delta this gameweek, in millions */
  priceChangeEvent: number;
  /** minutes played this season */
  minutes: number;
  /** points scored in the current/last gameweek */
  eventPoints: number;
}

export interface Team {
  id: number;
  name: string;
  shortName: string;
  strengthAttackHome: number;
  strengthAttackAway: number;
  strengthDefenceHome: number;
  strengthDefenceAway: number;
}

export interface Fixture {
  id: number;
  /** null = unscheduled */
  gameweek: number | null;
  /** ISO string, or null when unscheduled */
  kickoff: string | null;
  homeTeamId: number;
  awayTeamId: number;
  /** 1-5, difficulty for the home team */
  homeDifficulty: number;
  /** 1-5, difficulty for the away team */
  awayDifficulty: number;
  finished: boolean;
}

export interface Gameweek {
  id: number;
  name: string;
  deadline: string; // ISO
  deadlineEpoch: number; // seconds
  averageEntryScore: number;
  finished: boolean;
  dataChecked: boolean;
  isCurrent: boolean;
  isNext: boolean;
  isPrevious: boolean;
  mostCaptainedId: number | null;
}

export interface Pick {
  playerId: number;
  /** 1-15, squad slot order (1-11 start, 12-15 bench before subs) */
  position: number;
  /** 0 bench, 1 starter, 2 captain, 3 triple captain */
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export interface AutomaticSub {
  inId: number;
  outId: number;
}

export interface GameweekEntry {
  gameweek: number;
  /** after multipliers, after hits */
  points: number;
  pointsOnBench: number;
  rank: number | null;
  overallRank: number | null;
  transfers: number;
  transferCost: number;
  /** in millions */
  squadValue: number;
  /** in millions */
  bank: number;
  chip: ChipName | null;
}

export interface Transfer {
  gameweek: number;
  inPlayerId: number;
  outPlayerId: number;
  /** in millions */
  inCost: number;
  /** in millions */
  outCost: number;
  time: string; // ISO
}

export interface EntrySummary {
  id: number;
  entryName: string;
  playerName: string;
  overallPoints: number;
  overallRank: number | null;
  currentEvent: number;
  /** in millions */
  squadValue: number;
  /** in millions */
  bank: number;
}

export interface LeagueStanding {
  entryId: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  total: number;
  gameweekPoints: number;
}

export interface League {
  id: number;
  name: string;
  standings: LeagueStanding[];
}

/** A rival's resolved squad for one completed gameweek, plus their chip history. */
export interface RivalSquad {
  entryId: number;
  entryName: string;
  playerName: string;
  gameweek: number;
  picks: Pick[];
  automaticSubs: AutomaticSub[];
  activeChip: ChipName | null;
  /** chips used in past gameweeks: { name, event } */
  chipsUsed: { name: ChipName; event: number }[];
}

export type GameStatus = 'live' | 'updating' | 'unavailable';

/** Wrapper every internal API route returns. */
export interface ApiEnvelope<T> {
  data: T;
  meta: {
    /** the gameweek the exposure-derived figures are "as of" */
    asOfGw: number | null;
    gameStatus: GameStatus;
    /** true when data was served from a stored snapshot rather than live */
    stale: boolean;
    generatedAt: string; // ISO
  };
}
