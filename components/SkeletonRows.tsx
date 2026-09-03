/**
 * Skeleton rows must match final row height exactly — layout shift on a phone
 * is what makes an app feel slow even when it isn't. The real <Row> is
 * px-4 py-3 with a two-line body; this mirrors that.
 */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="border-b border-line px-4 py-3 last:border-b-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-3 w-16" />
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-5 w-10" />
          </div>
        </li>
      ))}
    </ul>
  );
}
