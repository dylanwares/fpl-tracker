'use client';

import { useEffect, useState } from 'react';

function format(msLeft: number): string {
  if (msLeft <= 0) return 'deadline passed';
  const totalMinutes = Math.floor(msLeft / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface Props {
  /** epoch seconds */
  deadlineEpoch: number | null;
}

export function DeadlineCountdown({ deadlineEpoch }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineEpoch) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [deadlineEpoch]);

  if (!deadlineEpoch) return <span className="text-muted">no deadline</span>;

  const msLeft = deadlineEpoch * 1000 - now;
  const urgent = msLeft > 0 && msLeft < 3 * 3600 * 1000;

  return (
    <span className={`tnum ${urgent ? 'text-threat' : 'text-text'}`}>
      {format(msLeft)}
    </span>
  );
}
