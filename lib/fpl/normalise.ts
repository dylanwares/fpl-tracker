/**
 * Raw upstream JSON -> domain model. Parsed defensively: upstream numbers often
 * arrive as strings, and fields occasionally vanish between seasons.
 */

import type {
  RawBootstrap,
  RawChip,
  RawElement,
  RawElementType,
  RawEntry,
  RawEntryHistory,
  RawEvent,
  RawFixture,
  RawPick,
  RawPicksResponse,
  RawStandingResult,
  RawTeam,
  RawTransfer,
} from '@/lib/fpl/raw-types';
import type {
  AutomaticSub,
  ChipName,
  EntrySummary,
  Fixture,
  Gameweek,
  GameweekEntry,
  LeagueStanding,
  Pick,
  Player,
  PlayerStatus,
  Position,
  Team,
  Transfer,
} from '@/lib/types';

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

const POSITION_FALLBACK: Record<number, Position> = {
  1: 'GKP',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export interface Bootstrap {
  events: Gameweek[];
  teams: Map<number, Team>;
  players: Map<number, Player>;
  totalPlayers: number;
  /** id -> Position, from element_types */
  positionByType: Map<number, Position>;
}

function normaliseEvent(e: RawEvent): Gameweek {
  return {
    id: e.id,
    name: e.name,
    deadline: e.deadline_time,
    deadlineEpoch: num(e.deadline_time_epoch),
    averageEntryScore: num(e.average_entry_score),
    finished: Boolean(e.finished),
    dataChecked: Boolean(e.data_checked),
    isCurrent: Boolean(e.is_current),
    isNext: Boolean(e.is_next),
    isPrevious: Boolean(e.is_previous),
    mostCaptainedId: e.most_captained ?? null,
  };
}

function normaliseTeam(t: RawTeam): Team {
  return {
    id: t.id,
    name: t.name,
    shortName: t.short_name,
    strengthAttackHome: num(t.strength_attack_home),
    strengthAttackAway: num(t.strength_attack_away),
    strengthDefenceHome: num(t.strength_defence_home),
    strengthDefenceAway: num(t.strength_defence_away),
  };
}

function normalisePlayer(
  el: RawElement,
  positionByType: Map<number, Position>,
  teamsById: Map<number, RawTeam>,
): Player {
  const status = (['a', 'd', 'i', 's', 'u', 'n'].includes(el.status)
    ? el.status
    : 'a') as PlayerStatus;
  return {
    id: el.id,
    webName: el.web_name,
    fullName: `${el.first_name} ${el.second_name}`.trim(),
    teamId: el.team,
    teamShort: teamsById.get(el.team)?.short_name ?? '???',
    position: positionByType.get(el.element_type) ?? POSITION_FALLBACK[el.element_type] ?? 'MID',
    price: num(el.now_cost) / 10,
    totalPoints: num(el.total_points),
    form: num(el.form),
    pointsPerGame: num(el.points_per_game),
    selectedByPercent: num(el.selected_by_percent),
    xG: num(el.expected_goals),
    xA: num(el.expected_assists),
    xGI90: num(el.expected_goal_involvements_per_90),
    expectedGoalsConceded: num(el.expected_goals_conceded),
    status,
    chanceOfPlaying:
      el.chance_of_playing_this_round === null ||
      el.chance_of_playing_this_round === undefined
        ? null
        : num(el.chance_of_playing_this_round),
    news: el.news ?? '',
    priceChangeEvent: num(el.cost_change_event) / 10,
  };
}

export function normaliseBootstrap(raw: RawBootstrap): Bootstrap {
  const positionByType = new Map<number, Position>();
  for (const et of raw.element_types ?? []) {
    const short = (et as RawElementType).singular_name_short?.toUpperCase();
    if (short === 'GKP' || short === 'DEF' || short === 'MID' || short === 'FWD') {
      positionByType.set(et.id, short);
    }
  }

  const rawTeamsById = new Map<number, RawTeam>();
  for (const t of raw.teams ?? []) rawTeamsById.set(t.id, t);

  const teams = new Map<number, Team>();
  for (const t of raw.teams ?? []) teams.set(t.id, normaliseTeam(t));

  const players = new Map<number, Player>();
  for (const el of raw.elements ?? []) {
    players.set(el.id, normalisePlayer(el, positionByType, rawTeamsById));
  }

  return {
    events: (raw.events ?? []).map(normaliseEvent),
    teams,
    players,
    totalPlayers: num(raw.total_players),
    positionByType,
  };
}

export function normaliseFixture(f: RawFixture): Fixture {
  return {
    id: f.id,
    gameweek: f.event ?? null,
    kickoff: f.kickoff_time ?? null,
    homeTeamId: f.team_h,
    awayTeamId: f.team_a,
    homeDifficulty: num(f.team_h_difficulty, 3),
    awayDifficulty: num(f.team_a_difficulty, 3),
    finished: Boolean(f.finished),
  };
}

export function normaliseEntrySummary(e: RawEntry): EntrySummary {
  return {
    id: e.id,
    entryName: e.name,
    playerName: `${e.player_first_name} ${e.player_last_name}`.trim(),
    overallPoints: num(e.summary_overall_points),
    overallRank: e.summary_overall_rank ?? null,
    currentEvent: num(e.current_event),
    squadValue: num(e.last_deadline_value) / 10,
    bank: num(e.last_deadline_bank) / 10,
  };
}

export function normaliseChipName(raw: string | null | undefined): ChipName | null {
  if (!raw) return null;
  return raw as ChipName;
}

export function normalisePick(p: RawPick): Pick {
  return {
    playerId: p.element,
    position: p.position,
    multiplier: p.multiplier,
    isCaptain: Boolean(p.is_captain),
    isViceCaptain: Boolean(p.is_vice_captain),
  };
}

export function normaliseAutomaticSubs(raw: RawPicksResponse): AutomaticSub[] {
  return (raw.automatic_subs ?? []).map((s) => ({
    inId: s.element_in,
    outId: s.element_out,
  }));
}

export function normaliseHistory(raw: RawEntryHistory): GameweekEntry[] {
  const chipByEvent = new Map<number, ChipName>();
  for (const c of (raw.chips ?? []) as RawChip[]) {
    chipByEvent.set(c.event, c.name as ChipName);
  }
  return (raw.current ?? []).map((row) => ({
    gameweek: row.event,
    points: num(row.points),
    pointsOnBench: num(row.points_on_bench),
    rank: row.rank ?? null,
    overallRank: row.overall_rank ?? null,
    transfers: num(row.event_transfers),
    transferCost: num(row.event_transfers_cost),
    squadValue: num(row.value) / 10,
    bank: num(row.bank) / 10,
    chip: chipByEvent.get(row.event) ?? null,
  }));
}

export function normaliseChipsUsed(
  raw: RawEntryHistory,
): { name: ChipName; event: number }[] {
  return (raw.chips ?? []).map((c) => ({
    name: c.name as ChipName,
    event: c.event,
  }));
}

export function normaliseTransfer(t: RawTransfer): Transfer {
  return {
    gameweek: t.event,
    inPlayerId: t.element_in,
    outPlayerId: t.element_out,
    inCost: num(t.element_in_cost) / 10,
    outCost: num(t.element_out_cost) / 10,
    time: t.time,
  };
}

export function normaliseStanding(r: RawStandingResult): LeagueStanding {
  return {
    entryId: r.entry,
    entryName: r.entry_name,
    playerName: r.player_name,
    rank: r.rank,
    lastRank: r.last_rank,
    total: num(r.total),
    gameweekPoints: num(r.event_total),
  };
}
