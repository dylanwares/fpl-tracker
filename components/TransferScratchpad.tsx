'use client';

import { useEffect, useState } from 'react';

import { signed } from '@/lib/format';

interface SquadPlayer {
  id: number;
  webName: string;
  teamShort: string;
  position: string;
  price: number;
}

interface Note {
  outId: number | null;
  inName: string;
  inPrice: number;
}

const KEY = 'fpl-tracker:scratchpad';

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return []; // private mode / cleared storage
  }
}

/**
 * A throwaway planning surface: jot "sell X, buy Y at £Zm" lines and see the
 * running cost. Persisted only in this browser — it is a scratchpad, not data.
 */
export function TransferScratchpad({ squad }: { squad: SquadPlayer[] }) {
  // Start empty so SSR and first client render agree, then hydrate from storage.
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [outId, setOutId] = useState<number | null>(null);
  const [inName, setInName] = useState('');
  const [inPrice, setInPrice] = useState('');

  // One intentional re-render on mount to pull in browser-only persisted state;
  // starting from [] keeps SSR and first client render identical.
  useEffect(() => {
    const saved = loadNotes();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved.length) setNotes(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't clobber storage before the initial read
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch {
      /* ignore */
    }
  }, [notes, hydrated]);

  const byId = new Map(squad.map((p) => [p.id, p]));
  const netSpend = notes.reduce((sum, n) => {
    const out = n.outId ? (byId.get(n.outId)?.price ?? 0) : 0;
    return sum + (n.inPrice - out);
  }, 0);

  function add() {
    const price = Number.parseFloat(inPrice);
    if (!inName.trim() || !Number.isFinite(price)) return;
    setNotes((n) => [...n, { outId, inName: inName.trim(), inPrice: price }]);
    setInName('');
    setInPrice('');
    setOutId(null);
  }

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={outId ?? ''}
          onChange={(e) =>
            setOutId(e.target.value ? Number(e.target.value) : null)
          }
          className="rounded border border-line bg-surface-2 px-2 py-1"
        >
          <option value="">sell…</option>
          {squad.map((p) => (
            <option key={p.id} value={p.id}>
              {p.webName} ({p.position} £{p.price.toFixed(1)})
            </option>
          ))}
        </select>
        <span className="text-muted">→</span>
        <input
          value={inName}
          onChange={(e) => setInName(e.target.value)}
          placeholder="buy…"
          className="w-28 rounded border border-line bg-surface-2 px-2 py-1"
        />
        <input
          value={inPrice}
          onChange={(e) => setInPrice(e.target.value)}
          inputMode="decimal"
          placeholder="£m"
          className="w-16 rounded border border-line bg-surface-2 px-2 py-1 tnum"
        />
        <button
          type="button"
          onClick={add}
          className="rounded border border-line px-2 py-1 text-muted hover:text-text"
        >
          add
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {notes.map((n, i) => {
            const out = n.outId ? byId.get(n.outId) : null;
            const delta = n.inPrice - (out?.price ?? 0);
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-2 py-1.5"
              >
                <span className="truncate">
                  {out ? out.webName : '—'}{' '}
                  <span className="text-muted">→</span> {n.inName}{' '}
                  <span className="text-muted tnum">
                    £{n.inPrice.toFixed(1)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`tnum ${delta > 0 ? 'text-threat' : 'text-gain'}`}
                  >
                    {signed(delta)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotes((list) => list.filter((_, j) => j !== i))
                    }
                    className="text-muted hover:text-text"
                    aria-label="remove"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-3 text-xs text-muted tnum">
        net spend {signed(netSpend)} · before bank / selling-price rules
      </p>
    </div>
  );
}
