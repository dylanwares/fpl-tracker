import type { ChipName } from '@/lib/types';

/**
 * Chips available per half-season under current FPL rules. Managers get one of
 * each in each half, but the API only tells us what has been *used*, so this is
 * the baseline we subtract from. "manager"/assistant-manager style chips are
 * intentionally omitted — pass-through handles unknown chip names elsewhere.
 */
export const ALL_CHIPS: ChipName[] = ['wildcard', 'freehit', 'bboost', '3xc'];

export const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Captain',
};

export function chipLabel(name: ChipName | null): string {
  if (!name) return '—';
  return CHIP_LABELS[name] ?? name;
}
