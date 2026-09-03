import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Disclosure } from '@/components/Disclosure';
import { SkeletonRows } from '@/components/SkeletonRows';
import { Empty, Section } from '@/components/ui';
import { ALL_CHIPS, chipLabel } from '@/lib/chips';
import { getExposureModel } from '@/lib/exposure-model';

export const dynamic = 'force-dynamic';

export default async function LeaguePage({
  params,
}: PageProps<'/leagues/[id]'>) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return (
    <div className="pb-12">
      <Suspense
        fallback={
          <Section title="League">
            <SkeletonRows count={8} />
          </Section>
        }
      >
        <LeagueBody leagueId={id} />
      </Suspense>
    </div>
  );
}

async function LeagueBody({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  const sorted = [...model.standings].sort((a, b) => a.rank - b.rank);

  const playerMeta = new Map(
    model.players.map((p) => [
      p.playerId,
      { webName: p.player.webName, teamShort: p.player.teamShort, position: p.player.position },
    ]),
  );
  const rivalById = new Map(model.rivalsFull.map((r) => [r.entryId, r]));

  return (
    <>
      <Section title={model.leagueName} aside={`as of GW${model.asOfGw}`}>
        <ul className="divide-y divide-line">
          {sorted.map((s) => {
            const isMe = s.entryId === model.myEntryId;
            const move = s.lastRank - s.rank;
            return (
              <li
                key={s.entryId}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                  isMe ? 'bg-surface-2' : ''
                }`}
              >
                <span className="w-6 text-muted tnum">{s.rank}</span>
                <span className="flex-1 truncate">
                  <span className={isMe ? 'font-semibold' : ''}>
                    {s.playerName}
                  </span>
                  <span className="ml-2 text-xs text-muted">{s.entryName}</span>
                </span>
                {move !== 0 && (
                  <span
                    className={`text-xs tnum ${move > 0 ? 'text-gain' : 'text-threat'}`}
                  >
                    {move > 0 ? '▲' : '▼'}
                    {Math.abs(move)}
                  </span>
                )}
                <span className="tnum">{s.total}</span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section
        title="Rival squads"
        aside={`last deadline · GW${model.asOfGw}`}
      >
        {model.rivals.length === 0 ? (
          <Empty>No rivals resolved for this gameweek yet.</Empty>
        ) : (
          model.rivals.map((r) => {
            const full = rivalById.get(r.entryId);
            const standing = sorted.find((s) => s.entryId === r.entryId);
            const used = new Set(full?.chipsUsed.map((c) => c.name) ?? []);
            const remaining = ALL_CHIPS.filter((c) => !used.has(c));
            const picks = (full?.picks ?? [])
              .slice()
              .sort((a, b) => a.position - b.position);
            const xi = picks.filter((p) => p.position <= 11);
            const bench = picks.filter((p) => p.position > 11);
            return (
              <Disclosure
                key={r.entryId}
                summary={
                  <span className="flex-1 truncate">
                    <span className="text-muted tnum">
                      {standing?.rank ?? '—'}.
                    </span>{' '}
                    {r.playerName}
                    <span className="ml-2 text-xs text-muted">
                      {remaining.length
                        ? `chips: ${remaining.map(chipLabel).join(', ')}`
                        : 'no chips left'}
                      {full?.activeChip
                        ? ` · played ${chipLabel(full.activeChip)}`
                        : ''}
                    </span>
                  </span>
                }
              >
                <PickList
                  title="XI"
                  picks={xi}
                  meta={playerMeta}
                />
                <PickList title="Bench" picks={bench} meta={playerMeta} />
              </Disclosure>
            );
          })
        )}
      </Section>

      <Section title="Chips remaining">
        <ul className="divide-y divide-line text-sm">
          {model.rivals.map((r) => {
            const full = rivalById.get(r.entryId);
            const used = new Set(full?.chipsUsed.map((c) => c.name) ?? []);
            const remaining = ALL_CHIPS.filter((c) => !used.has(c));
            return (
              <li
                key={r.entryId}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span className="truncate">{r.playerName}</span>
                <span className="text-xs text-muted">
                  {remaining.length
                    ? remaining.map(chipLabel).join(' · ')
                    : 'none'}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

function PickList({
  title,
  picks,
  meta,
}: {
  title: string;
  picks: { playerId: number; isCaptain: boolean; isViceCaptain: boolean }[];
  meta: Map<number, { webName: string; teamShort: string; position: string }>;
}) {
  return (
    <div className="pt-3">
      <p className="text-xs text-muted">{title}</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {picks.map((p) => {
          const m = meta.get(p.playerId);
          return (
            <li key={p.playerId} className="truncate">
              {m?.webName ?? `#${p.playerId}`}
              {p.isCaptain && <span className="ml-1 text-xs text-gain">C</span>}
              {p.isViceCaptain && (
                <span className="ml-1 text-xs text-muted">V</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
