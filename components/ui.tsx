import type { ReactNode } from 'react';

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-4">
      <div className="flex items-baseline justify-between px-4">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        {aside && <div className="text-xs text-muted">{aside}</div>}
      </div>
      <div className="mt-2 border-y border-line bg-surface">{children}</div>
    </section>
  );
}

export function Tile({
  label,
  value,
  tone = 'plain',
  sub,
}: {
  label: string;
  value: ReactNode;
  tone?: 'plain' | 'gain' | 'threat';
  sub?: ReactNode;
}) {
  const color =
    tone === 'gain'
      ? 'text-gain'
      : tone === 'threat'
        ? 'text-threat'
        : 'text-text';
  return (
    <div className="flex-1 px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold tnum ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted tnum">{sub}</div>}
    </div>
  );
}

export function TileRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex divide-x divide-line border-y border-line bg-surface">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-sm text-muted">{children}</p>;
}
