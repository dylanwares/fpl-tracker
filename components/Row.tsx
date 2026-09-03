'use client';

import { useState } from 'react';

import { DivergingBar } from '@/components/DivergingBar';
import { difficultyColor, price, signed, statusMeta } from '@/lib/format';
import type { ExposureRowDto } from '@/lib/rows';

interface Props {
  row: ExposureRowDto;
  /** rival count, for the "n of N own" line */
  rivalCount: number;
  /** largest |swing| in the list this row belongs to, for bar scaling */
  maxSwing: number;
}

/**
 * One list row (spec section 8). Line one is identity; line two is the position
 * — ownership on the left, the diverging bar in the middle, the signed swing on
 * the right at the largest size. Tap to expand in place: no modal, no nav.
 */
export function Row({ row, rivalCount, maxSwing }: Props) {
  const [open, setOpen] = useState(false);
  const sm = statusMeta(row.status);
  const swingTone =
    row.swing > 0 ? 'text-gain' : row.swing < 0 ? 'text-threat' : 'text-muted';

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="block w-full px-4 py-3 text-left"
      >
        {/* line 1 — identity */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 truncate">
            <span className="font-semibold">{row.webName}</span>
            <span className="text-xs text-muted">{row.teamShort}</span>
            {sm.tone !== 'ok' && (
              <span
                className="text-xs"
                style={{
                  color: sm.tone === 'bad' ? 'var(--threat)' : 'var(--muted)',
                }}
                title={row.news || sm.label}
              >
                ● {sm.label}
              </span>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted tnum">
            {row.fixtureLabel}
          </span>
        </div>

        {/* line 2 — the position */}
        <div className="mt-1.5 grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
          <span className="text-xs text-muted tnum">
            {row.rivalOwnerCount} of {rivalCount} own
            {row.rivalCaptainCount > 0 && `, ${row.rivalCaptainCount} captain`}
          </span>
          <DivergingBar value={row.swing} max={maxSwing} />
          <span className={`text-lg font-semibold tnum ${swingTone}`}>
            {signed(row.swing)}
          </span>
        </div>
      </button>

      {open && (
        <div className="bg-surface-2 px-4 pb-4 pt-1 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Stat label="my EO" value={row.myEO.toFixed(2)} />
            <Stat label="rival EO" value={row.rivalEO.toFixed(2)} />
            <Stat label="net EO" value={signed(row.netEO, 2)} />
            <Stat
              label="projected"
              value={row.projectedPoints.toFixed(1)}
            />
            <Stat label="price" value={price(row.price)} />
            <Stat label="form" value={row.form.toFixed(1)} />
            <Stat
              label="status"
              value={
                row.chanceOfPlaying !== null && row.chanceOfPlaying < 100
                  ? `${sm.label} ${row.chanceOfPlaying}%`
                  : sm.label
              }
            />
            <Stat
              label="expected"
              value={
                row.swing >= 0
                  ? `+${row.expectedGain.toFixed(1)} gain`
                  : `−${row.expectedDamage.toFixed(1)} damage`
              }
            />
          </dl>

          {row.news && (
            <p className="mt-3 text-xs text-muted">{row.news}</p>
          )}

          <div className="mt-3">
            <p className="text-xs text-muted">
              rivals with him:{' '}
              {row.rivalOwnerNames.length
                ? row.rivalOwnerNames.join(', ')
                : 'none'}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.fixtureRun.map((f) => (
              <span
                key={f.gameweek}
                className="rounded border border-line px-1.5 py-0.5 text-xs tnum"
                style={{ color: difficultyColor(f.difficulty) }}
              >
                GW{f.gameweek} {f.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tnum">{value}</dd>
    </div>
  );
}
