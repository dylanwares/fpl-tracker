import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';

import './globals.css';

import { BottomNav } from '@/components/BottomNav';
import { DowntimeBanner } from '@/components/DowntimeBanner';
import { StickyHeader } from '@/components/StickyHeader';
import { getConfig } from '@/lib/config';
import { getShellData } from '@/lib/shell';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FPL Tracker',
  description: 'Personal Fantasy Premier League planning dashboard',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'FPL', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#1C1421',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shell = await getShellData();
  let primaryLeagueId = 0;
  try {
    primaryLeagueId = getConfig().primaryLeagueId;
  } catch {
    // config error surfaced below
  }

  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="min-h-full pb-14">
        <DowntimeBanner status={shell.gameStatus} asOfGw={shell.asOfGw} />
        <StickyHeader
          targetGw={shell.targetGw}
          deadlineEpoch={shell.deadlineEpoch}
          asOfGw={shell.asOfGw}
        />
        <main className="mx-auto max-w-2xl">
          {shell.configError ? (
            <div className="m-4 rounded-lg border border-threat/40 bg-threat/10 p-4 text-sm">
              <p className="font-semibold">Configuration needed</p>
              <p className="mt-1 text-muted">{shell.configError}</p>
              <p className="mt-2 text-muted">
                Copy <code>.env.example</code> to <code>.env.local</code> and set{' '}
                <code>FPL_ENTRY_ID</code> and <code>FPL_PRIMARY_LEAGUE_ID</code>.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
        <BottomNav primaryLeagueId={primaryLeagueId} />
      </body>
    </html>
  );
}
