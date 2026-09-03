/**
 * Flatten a PlayerExposure into the row shape the UI list renders. One shape
 * for threats, differentials and the dashboard so <Row> stays generic.
 */

import type { PlayerExposure } from '@/lib/exposure-model';

export interface ExposureRowDto {
  playerId: number;
  webName: string;
  fullName: string;
  teamShort: string;
  position: string;
  price: number;
  form: number;
  status: string;
  news: string;
  chanceOfPlaying: number | null;
  fixtureLabel: string;
  fixtureRun: { gameweek: number; label: string; difficulty: number }[];
  myEO: number;
  rivalEO: number;
  netEO: number;
  rivalOwnerCount: number;
  rivalOwnerIds: number[];
  rivalOwnerNames: string[];
  rivalCaptainCount: number;
  iOwn: boolean;
  iCaptain: boolean;
  projectedPoints: number;
  swing: number;
  expectedDamage: number;
  expectedGain: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function toRow(
  p: PlayerExposure,
  rivalNameById?: Map<number, string>,
): ExposureRowDto {
  return {
    playerId: p.playerId,
    webName: p.player.webName,
    fullName: p.player.fullName,
    teamShort: p.player.teamShort,
    position: p.player.position,
    price: p.player.price,
    form: p.player.form,
    status: p.player.status,
    news: p.player.news,
    chanceOfPlaying: p.player.chanceOfPlaying,
    fixtureLabel: p.fixtureLabel,
    fixtureRun: p.fixtureRun,
    myEO: round(p.myEO),
    rivalEO: round(p.rivalEO),
    netEO: round(p.netEO),
    rivalOwnerCount: p.rivalOwnerCount,
    rivalOwnerIds: p.rivalOwnerIds,
    rivalOwnerNames: rivalNameById
      ? p.rivalOwnerIds.map((id) => rivalNameById.get(id) ?? `#${id}`)
      : [],
    rivalCaptainCount: p.rivalCaptainCount,
    iOwn: p.iOwn,
    iCaptain: p.iCaptain,
    projectedPoints: round(p.projectedPoints),
    swing: round(p.swing),
    expectedDamage: round(p.expectedDamage),
    expectedGain: round(p.expectedGain),
  };
}

/** Build the id -> name lookup from an ExposureModel's rival list. */
export function rivalNameMap(
  rivals: { entryId: number; playerName: string; entryName: string }[],
): Map<number, string> {
  return new Map(rivals.map((r) => [r.entryId, r.playerName || r.entryName]));
}
