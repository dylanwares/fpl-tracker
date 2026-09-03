/**
 * "as of GW{n}" — almost every figure in the app depends on the last resolved
 * gameweek, so it gets said once in the header and repeated small on each table.
 */
export function AsOfStamp({
  gw,
  className = '',
}: {
  gw: number | null;
  className?: string;
}) {
  if (!gw) return null;
  return (
    <span className={`text-muted ${className}`}>as of GW{gw}</span>
  );
}
