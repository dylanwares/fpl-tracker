/**
 * A tiny zero-anchored bar series for the analysis page. Inline SVG, no library,
 * readable in both the gain and threat directions.
 */
export function MiniBars({
  values,
  labels,
  height = 64,
}: {
  values: number[];
  labels?: (string | number)[];
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values.map((v) => Math.abs(v)), 1);
  const barW = 100 / values.length;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label="bar chart"
    >
      <line
        x1="0"
        x2="100"
        y1={height / 2}
        y2={height / 2}
        stroke="var(--line)"
        strokeWidth="0.5"
      />
      {values.map((v, i) => {
        const h = (Math.abs(v) / max) * (height / 2);
        const x = i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = v >= 0 ? height / 2 - h : height / 2;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={Math.max(h, 0.5)}
            fill={v >= 0 ? 'var(--gain)' : 'var(--threat)'}
          />
        );
      })}
      {labels &&
        labels.map((l, i) => (
          <text
            key={i}
            x={i * barW + barW / 2}
            y={height - 1}
            fontSize="3"
            fill="var(--muted)"
            textAnchor="middle"
          >
            {l}
          </text>
        ))}
    </svg>
  );
}
