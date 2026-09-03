import type { GameStatus } from '@/lib/types';

/**
 * Named, not apologetic. "FPL is updating. Showing data from GW7." Shown across
 * the app whenever the game status is not 'live'.
 */
export function DowntimeBanner({
  status,
  asOfGw,
}: {
  status: GameStatus;
  asOfGw: number | null;
}) {
  if (status === 'live') return null;

  const text =
    status === 'updating'
      ? 'FPL is updating the gameweek.'
      : 'FPL is unavailable right now.';
  const suffix = asOfGw
    ? ` Showing data from GW${asOfGw}, which may be out of date.`
    : ' Showing the last data available.';

  return (
    <div className="border-b border-line bg-threat/15 px-4 py-2 text-center text-sm text-text">
      {text}
      {suffix}
    </div>
  );
}
