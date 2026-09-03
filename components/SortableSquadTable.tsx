'use client';

import { useState } from 'react';

import { price, signed } from '@/lib/format';
import type { ScoutPlayer } from '@/lib/scout';

type Key = 'points' | 'value' | 'form' | 'ownership';

const SORTS: Record<Key, (a: ScoutPlayer, b: ScoutPlayer) => number> = {
  points: (a, b) => b.totalPoints - a.totalPoints,
  value: (a, b) => b.pointsPerMillion - a.pointsPerMillion,
  form: (a, b) => b.form - a.form,
  ownership: (a, b) => b.selectedByPercent - a.selectedByPercent,
};

export function SortableSquadTable({ rows }: { rows: ScoutPlayer[] }) {
  const [key, setKey] = useState<Key>('value');
  const sorted = [...rows].sort(SORTS[key]);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div>
      <div className="flex gap-1 px-4 py-2 text-xs">
        {(['value', 'points', 'form', 'ownership'] as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={`rounded border px-2 py-1 ${
              key === k
                ? 'border-line bg-surface-2 text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {k === 'value' ? 'pts / £m' : k}
          </button>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line text-xs text-muted">
            <th className="px-4 py-1.5 text-left font-normal">player</th>
            <th className="px-2 py-1.5 text-right font-normal">£m</th>
            <th className="px-2 py-1.5 text-right font-normal">pts</th>
            <th className="px-2 py-1.5 text-right font-normal">/£m</th>
            <th className="px-2 py-1.5 text-right font-normal">form</th>
            <th className="px-4 py-1.5 text-right font-normal">own</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.id}
              className={`border-b border-line last:border-b-0 ${
                p.id === best.id
                  ? 'bg-gain/5'
                  : p.id === worst.id
                    ? 'bg-threat/5'
                    : ''
              }`}
            >
              <td className="px-4 py-1.5">
                <span className="text-xs text-muted">{p.position}</span>{' '}
                {p.webName}
                {!p.inMyXi && (
                  <span className="ml-1 text-xs text-muted">(bench)</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-right tnum text-muted">
                {p.price.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right tnum">{p.totalPoints}</td>
              <td className="px-2 py-1.5 text-right tnum">
                {p.pointsPerMillion.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right tnum text-muted">
                {p.form.toFixed(1)}
              </td>
              <td className="px-4 py-1.5 text-right tnum text-muted">
                {p.selectedByPercent.toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="px-4 py-2 text-xs text-muted">
        best {key === 'value' ? 'value' : key}: {best.webName} · worst:{' '}
        {worst.webName}
        {key === 'points' && ` (${signed(best.priceChangeEvent)} / ${price(best.price)})`}
      </p>
    </div>
  );
}
