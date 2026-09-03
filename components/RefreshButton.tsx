'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [spun, setSpun] = useState(false);

  return (
    <button
      type="button"
      aria-label="Refresh data"
      onClick={() => {
        setSpun(true);
        startTransition(() => router.refresh());
        setTimeout(() => setSpun(false), 600);
      }}
      className="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-50"
      disabled={pending}
    >
      <span className={spun ? 'inline-block animate-spin' : 'inline-block'}>
        ↻
      </span>{' '}
      refresh
    </button>
  );
}
