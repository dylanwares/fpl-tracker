'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  primaryLeagueId: number;
}

export function BottomNav({ primaryLeagueId }: Props) {
  const pathname = usePathname();
  // Threats first, then the league, then my squad, then the retrospective views.
  const items = [
    { href: '/', label: 'Plan', match: (p: string) => p === '/' },
    {
      href: `/leagues/${primaryLeagueId}`,
      label: 'League',
      match: (p: string) => p.startsWith('/leagues'),
    },
    { href: '/team', label: 'Team', match: (p: string) => p.startsWith('/team') },
    {
      href: '/analysis',
      label: 'Analysis',
      match: (p: string) => p.startsWith('/analysis'),
    },
    {
      href: '/review',
      label: 'Review',
      match: (p: string) => p.startsWith('/review'),
    },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex h-14 items-center justify-center text-sm font-medium transition-colors ${
                  active ? 'text-text' : 'text-muted hover:text-text'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative">
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-text" />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
