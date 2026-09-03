/**
 * One typed fetcher per upstream endpoint. TTLs follow the table in the spec
 * (section 2). These return raw upstream shapes; normalisation happens in
 * normalise.ts and the higher-level lib modules.
 */

import { fplFetch } from '@/lib/fpl/client';
import { ttlMemo } from '@/lib/memo';
import type {
  RawBootstrap,
  RawElementSummary,
  RawEntry,
  RawEntryHistory,
  RawEventStatus,
  RawFixture,
  RawPicksResponse,
  RawStandingsResponse,
  RawTransfer,
} from '@/lib/fpl/raw-types';

export const TTL = {
  bootstrap: 3600, // 1h
  fixtures: 43200, // 12h
  entry: 3600, // 1h
  history: 21600, // 6h
  picks: 21600, // 6h — immutable once the GW is resolved
  transfers: 3600, // 1h
  standings: 21600, // 6h
  elementSummary: 43200, // 12h
} as const;

export function fetchBootstrap() {
  // ~2.3MB — over Next's data-cache ceiling, so memo it in-process instead.
  return ttlMemo('bootstrap', TTL.bootstrap, () =>
    fplFetch<RawBootstrap>('/bootstrap-static/', { noStore: true }),
  );
}

export function fetchFixtures() {
  return ttlMemo('fixtures', TTL.fixtures, () =>
    fplFetch<RawFixture[]>('/fixtures/', {
      revalidate: TTL.fixtures,
      tags: ['fixtures'],
    }),
  );
}

export function fetchEntry(entryId: number) {
  return fplFetch<RawEntry>(`/entry/${entryId}/`, { revalidate: TTL.entry });
}

export function fetchEntryHistory(entryId: number) {
  return fplFetch<RawEntryHistory>(`/entry/${entryId}/history/`, {
    revalidate: TTL.history,
  });
}

export function fetchEntryPicks(entryId: number, gameweek: number) {
  return fplFetch<RawPicksResponse>(
    `/entry/${entryId}/event/${gameweek}/picks/`,
    { revalidate: TTL.picks, tags: [`picks:${gameweek}`] },
  );
}

export function fetchEntryTransfers(entryId: number) {
  return fplFetch<RawTransfer[]>(`/entry/${entryId}/transfers/`, {
    revalidate: TTL.transfers,
  });
}

export async function fetchLeagueStandings(
  leagueId: number,
  page = 1,
): Promise<RawStandingsResponse> {
  return fplFetch<RawStandingsResponse>(
    `/leagues-classic/${leagueId}/standings/?page_standings=${page}`,
    { revalidate: TTL.standings },
  );
}

export function fetchElementSummary(elementId: number) {
  return fplFetch<RawElementSummary>(`/element-summary/${elementId}/`, {
    revalidate: TTL.elementSummary,
  });
}

export function fetchEventStatus() {
  return fplFetch<RawEventStatus>('/event-status/', { noStore: true });
}
