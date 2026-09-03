import { AsOfStamp } from '@/components/AsOfStamp';
import { DeadlineCountdown } from '@/components/DeadlineCountdown';
import { RefreshButton } from '@/components/RefreshButton';

interface Props {
  targetGw: number | null;
  deadlineEpoch: number | null;
  asOfGw: number | null;
}

/**
 * Sticky across the app: the deadline countdown and the "as of GW{n}" stamp,
 * since almost every figure depends on both.
 */
export function StickyHeader({ targetGw, deadlineEpoch, asOfGw }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-2.5 text-sm">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">
            {targetGw ? `GW${targetGw}` : 'FPL'}
          </span>
          <span className="text-muted">·</span>
          <DeadlineCountdown deadlineEpoch={deadlineEpoch} />
        </div>
        <div className="flex items-center gap-3">
          <AsOfStamp gw={asOfGw} className="text-xs" />
          <RefreshButton />
        </div>
      </div>
    </header>
  );
}
