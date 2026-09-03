/**
 * Cheap data for the app shell: game status + the two gameweek numbers every
 * header and stamp depends on. Kept small so the shell renders immediately and
 * the expensive exposure work streams in behind it.
 */

import { cache } from 'react';

import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import {
  currentGameweek,
  lastResolvedGameweek,
  nextGameweek,
} from '@/lib/gameweek';
import type { GameStatus } from '@/lib/types';

export interface ShellData {
  gameStatus: GameStatus;
  targetGw: number | null;
  asOfGw: number | null;
  deadlineEpoch: number | null;
  deadlineIso: string | null;
  averageEntryScore: number | null;
  configError: string | null;
}

async function build(): Promise<ShellData> {
  try {
    const [gameStatus, rawBootstrap] = await Promise.all([
      getGameStatus(),
      fetchBootstrap(),
    ]);
    const bs = normaliseBootstrap(rawBootstrap);
    const next = nextGameweek(bs) ?? currentGameweek(bs);
    const resolved = lastResolvedGameweek(bs);
    const current = currentGameweek(bs);

    return {
      gameStatus,
      targetGw: next?.id ?? null,
      asOfGw: resolved?.id ?? null,
      deadlineEpoch: next?.deadlineEpoch ?? current?.deadlineEpoch ?? null,
      deadlineIso: next?.deadline ?? current?.deadline ?? null,
      averageEntryScore: current?.averageEntryScore ?? null,
      configError: null,
    };
  } catch (err) {
    if (err instanceof Error && /Missing required env var/.test(err.message)) {
      return {
        gameStatus: 'unavailable',
        targetGw: null,
        asOfGw: null,
        deadlineEpoch: null,
        deadlineIso: null,
        averageEntryScore: null,
        configError: err.message,
      };
    }
    return {
      gameStatus: 'unavailable',
      targetGw: null,
      asOfGw: null,
      deadlineEpoch: null,
      deadlineIso: null,
      averageEntryScore: null,
      configError: null,
    };
  }
}

export const getShellData = cache(build);
