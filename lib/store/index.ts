/**
 * Persistence. The FPL API keeps no history for mini-league standings, resolved
 * rival picks or price movement — only current state. Anything we want to look
 * back on (the deadline diff especially) we capture ourselves.
 *
 * Backed by Vercel KV in production; an in-memory / JSON-file stub locally so
 * the app runs with no external account.
 */

import type { LeagueSnapshot, PriceSnapshot } from '@/lib/store/schema';

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  /** keys matching a `prefix*` glob, newest-irrelevant order */
  keys(prefix: string): Promise<string[]>;
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const hasKv =
    !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
  // Lazy require so @vercel/kv is never loaded in the local path.
  if (hasKv) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('@/lib/store/kv').kvStore as Store;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    store = require('@/lib/store/memory').memoryStore as Store;
  }
  return store;
}

// ---- key helpers -----------------------------------------------------------

export const keys = {
  leagueSnapshot: (leagueId: number, gw: number) => `league:${leagueId}:gw:${gw}`,
  leagueSnapshotPrefix: (leagueId: number) => `league:${leagueId}:gw:`,
  prices: (date: string) => `prices:${date}`,
  pricesPrefix: () => 'prices:',
};

export type { LeagueSnapshot, PriceSnapshot };

// ---- convenience readers -------------------------------------------------

export async function readLeagueSnapshot(
  leagueId: number,
  gw: number,
): Promise<LeagueSnapshot | null> {
  return getStore().get<LeagueSnapshot>(keys.leagueSnapshot(leagueId, gw));
}

export async function latestLeagueSnapshots(
  leagueId: number,
  count = 2,
): Promise<LeagueSnapshot[]> {
  const store = getStore();
  const ks = await store.keys(keys.leagueSnapshotPrefix(leagueId));
  const gws = ks
    .map((k) => Number.parseInt(k.split(':').at(-1) ?? '', 10))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)
    .slice(0, count);
  const snaps = await Promise.all(
    gws.map((gw) => store.get<LeagueSnapshot>(keys.leagueSnapshot(leagueId, gw))),
  );
  return snaps.filter((s): s is LeagueSnapshot => s !== null);
}
