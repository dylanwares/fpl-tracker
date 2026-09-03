'use client';

import { useState, type ReactNode } from 'react';

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm"
      >
        {summary}
        <span className="shrink-0 text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="bg-surface-2 px-4 pb-4">{children}</div>}
    </div>
  );
}
