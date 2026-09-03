/**
 * Local fallback store: a process-wide Map, mirrored to .data/*.json so
 * snapshots survive a dev-server restart. Not for production (serverless
 * instances don't share memory or a writable FS) — that's what KV is for.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Store } from '@/lib/store';

const DIR = path.join(process.cwd(), '.data');
const mem = new Map<string, unknown>();
let hydrated = false;

function fileFor(key: string): string {
  return path.join(DIR, `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const entries = await fs.readdir(DIR);
    for (const name of entries) {
      if (!name.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(DIR, name), 'utf-8');
        const { key, value } = JSON.parse(raw) as { key: string; value: unknown };
        mem.set(key, value);
      } catch {
        // skip unreadable file
      }
    }
  } catch {
    // .data doesn't exist yet — fine
  }
}

export const memoryStore: Store = {
  async get<T>(key: string): Promise<T | null> {
    await hydrate();
    return (mem.get(key) as T | undefined) ?? null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await hydrate();
    mem.set(key, value);
    try {
      await fs.mkdir(DIR, { recursive: true });
      await fs.writeFile(fileFor(key), JSON.stringify({ key, value }, null, 2));
      console.log(`[memoryStore] wrote ${key}`);
    } catch (err) {
      console.warn(`[memoryStore] could not persist ${key}:`, err);
    }
  },
  async keys(prefix: string): Promise<string[]> {
    await hydrate();
    return [...mem.keys()].filter((k) => k.startsWith(prefix));
  },
};
