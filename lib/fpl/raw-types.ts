/**
 * Raw upstream response shapes from https://fantasy.premierleague.com/api.
 *
 * Only the fields this app reads are typed. The API is undocumented and shifts
 * between seasons, so everything is parsed defensively in normalise.ts — treat
 * these as "what we saw in a live 2026/27 response", not a contract.
 */

export interface RawBootstrap {
  events: RawEvent[];
  teams: RawTeam[];
  elements: RawElement[];
  element_types: RawElementType[];
  total_players: number;
}

export interface RawEvent {
  id: number;
  name: string;
  deadline_time: string;
  deadline_time_epoch: number;
  average_entry_score: number;
  finished: boolean;
  data_checked: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
  most_captained: number | null;
  most_selected: number | null;
}

export interface RawElementType {
  id: number;
  singular_name_short: string; // GKP | DEF | MID | FWD
}

export interface RawTeam {
  id: number;
  name: string;
  short_name: string;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface RawElement {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  now_cost: number; // tenths of a million
  total_points: number;
  form: string;
  points_per_game: string;
  selected_by_percent: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements_per_90: number | string;
  expected_goals_conceded: string;
  status: string;
  chance_of_playing_this_round: number | null;
  chance_of_playing_next_round: number | null;
  news: string;
  cost_change_event: number; // tenths
}

export interface RawFixture {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  finished: boolean;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
}

export interface RawEntry {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  current_event: number | null;
  last_deadline_value: number | null; // tenths
  last_deadline_bank: number | null; // tenths
}

export interface RawEntryHistory {
  current: RawEntryHistoryEvent[];
  chips: RawChip[];
  past: { season_name: string; total_points: number; rank: number }[];
}

export interface RawEntryHistoryEvent {
  event: number;
  points: number;
  total_points: number;
  rank: number | null;
  overall_rank: number | null;
  bank: number; // tenths
  value: number; // tenths
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface RawChip {
  name: string;
  event: number;
  time?: string;
}

export interface RawPicksResponse {
  active_chip: string | null;
  automatic_subs: RawAutomaticSub[];
  entry_history: RawEntryHistoryEvent | null;
  picks: RawPick[];
}

export interface RawAutomaticSub {
  element_in: number;
  element_out: number;
  event: number;
}

export interface RawPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  element_type?: number;
}

export type RawTransfer = {
  element_in: number;
  element_in_cost: number; // tenths
  element_out: number;
  element_out_cost: number; // tenths
  entry: number;
  event: number;
  time: string;
};

export interface RawStandingsResponse {
  league: { id: number; name: string };
  standings: {
    has_next: boolean;
    page: number;
    results: RawStandingResult[];
  };
}

export interface RawStandingResult {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  total: number;
  event_total: number;
}

export interface RawEventStatus {
  status: { bonus_added: boolean; date: string; event: number; points: string }[];
  leagues: string; // "Updated" | "Updating"
}

export interface RawElementSummary {
  fixtures: {
    id: number;
    event: number | null;
    is_home: boolean;
    difficulty: number;
    team_h: number;
    team_a: number;
    kickoff_time: string | null;
  }[];
  history: {
    element: number;
    fixture: number;
    round: number;
    total_points: number;
    minutes: number;
    was_home: boolean;
    opponent_team: number;
  }[];
}
