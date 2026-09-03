/**
 * Zero-anchored bar. Extends right for a differential (gain), left for a threat.
 * Every row in a list shares one centre line, so the shape of the league reads
 * before any number does.
 */
export function DivergingBar({
  value,
  max,
  className = '',
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, (Math.abs(value) / safeMax) * 100);
  const positive = value >= 0;

  return (
    <div
      className={`relative h-2.5 w-full ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      {/* zero axis */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
      {/* left half (threats) */}
      <div className="absolute inset-y-0 right-1/2 left-0">
        {!positive && (
          <div
            className="absolute inset-y-0 right-0 rounded-l-sm bg-threat"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {/* right half (differentials) */}
      <div className="absolute inset-y-0 left-1/2 right-0">
        {positive && (
          <div
            className="absolute inset-y-0 left-0 rounded-r-sm bg-gain"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
