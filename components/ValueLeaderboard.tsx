'use client';

import { useMemo, useState } from 'react';

import type { ScoutPlayer } from '@/lib/scout';
import type { Position } from '@/lib/types';

const POSITIONS: (Position | 'ALL')[] = ['ALL', 'GKP', 'DEF', 'MID', 'FWD'];

/**
 * Points-per-£m leaderboard across the whole pool, filterable by position and a
 * price ceiling. A minutes floor keeps out cheap players riding one fluke haul.
 */
export function ValueLeaderboard({
  pool,
  limit = 40,
}: {
  pool: ScoutPlayer[];
  limit?: number;
}) {
  const [pos, setPos] = useState<Position | 'ALL'>('ALL');
  const [maxPrice, setMaxPrice] = useState('');
  const [minMinutes, setMinMinutes] = useState('90');

  const rows = useMemo(() => {
    const cap = Number.parseFloat(maxPrice);
    const mins = Number.parseInt(minMinutes, 10) || 0;
    return pool
      .filter((p) => (pos === 'ALL' ? true : p.position === pos))
      .filter((p) => (Number.isFinite(cap) ? p.price <= cap : true))
      .filter((p) => p.minutes >= mins)
      .slice(0, limit);
  }, [pool, pos, maxPrice, minMinutes, limit]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPos(p)}
              className={`rounded border px-2 py-1 ${
                pos === p
                  ? 'border-line bg-surface-2 text-text'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {p === 'ALL' ? 'all' : p}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-muted">
          max £
          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            inputMode="decimal"
            placeholder="any"
            className="w-14 rounded border border-line bg-surface-2 px-1.5 py-1 tnum text-text"
          />
        </label>
        <label className="flex items-center gap-1 text-muted">
          min mins
          <input
            value={minMinutes}
            onChange={(e) => setMinMinutes(e.target.value)}
            inputMode="numeric"
            className="w-14 rounded border border-line bg-surface-2 px-1.5 py-1 tnum text-text"
          />
        </label>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line text-xs text-muted">
            <th className="px-4 py-1.5 text-left font-normal">player</th>
            <th className="px-2 py-1.5 text-right font-normal">£m</th>
            <th className="px-2 py-1.5 text-right font-normal">pts</th>
            <th className="px-2 py-1.5 text-right font-normal">/£m</th>
            <th className="px-4 py-1.5 text-right font-normal">own</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              className={`border-b border-line last:border-b-0 ${
                p.iOwn ? 'bg-surface-2' : ''
              }`}
            >
              <td className="px-4 py-1.5">
                <span className="text-xs text-muted">
                  {p.position} {p.teamShort}
                </span>{' '}
                {p.webName}
                {p.iOwn && <span className="ml-1 text-xs text-gain">✓</span>}
              </td>
              <td className="px-2 py-1.5 text-right tnum text-muted">
                {p.price.toFixed(1)}
              </td>
              <td className="px-2 py-1.5 text-right tnum">{p.totalPoints}</td>
              <td className="px-2 py-1.5 text-right tnum font-medium">
                {p.pointsPerMillion.toFixed(1)}
              </td>
              <td className="px-4 py-1.5 text-right tnum text-muted">
                {p.selectedByPercent.toFixed(0)}%
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                No players match those filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
