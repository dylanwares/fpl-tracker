import { Suspense } from 'react';

import { Row } from '@/components/Row';
import { SkeletonRows } from '@/components/SkeletonRows';
import { Empty, Section, Tile, TileRow } from '@/components/ui';
import { getConfig } from '@/lib/config';
import { getExposureModel } from '@/lib/exposure-model';
import { signed } from '@/lib/format';
import { getLeague } from '@/lib/league';
import { rivalNameMap, toRow } from '@/lib/rows';

export const dynamic = 'force-dynamic';

export default async function PlanningDashboard() {
  const { primaryLeagueId, entryId } = getConfig();

  return (
    <div className="pb-12">
      {/* cheap: standings render immediately */}
      <LeaguePosition leagueId={primaryLeagueId} myEntryId={entryId} />

      {/* expensive: exposure tables stream in behind */}
      <Suspense fallback={<SwingSkeleton />}>
        <ExpectedSwing leagueId={String(primaryLeagueId)} />
      </Suspense>

      <Section title="Threats" aside={<AsOf leagueId={String(primaryLeagueId)} />}>
        <Suspense fallback={<SkeletonRows count={6} />}>
          <ThreatList leagueId={String(primaryLeagueId)} />
        </Suspense>
      </Section>

      <Section title="My differentials">
        <Suspense fallback={<SkeletonRows count={5} />}>
          <DifferentialList leagueId={String(primaryLeagueId)} />
        </Suspense>
      </Section>

      <Section title="Captaincy concentration">
        <Suspense fallback={<SkeletonRows count={3} />}>
          <Captaincy leagueId={String(primaryLeagueId)} />
        </Suspense>
      </Section>
    </div>
  );
}

async function LeaguePosition({
  leagueId,
  myEntryId,
}: {
  leagueId: number;
  myEntryId: number;
}) {
  const league = await getLeague(leagueId);
  const sorted = [...league.standings].sort((a, b) => a.rank - b.rank);
  const meIdx = sorted.findIndex((s) => s.entryId === myEntryId);
  const me = sorted[meIdx];
  const ahead = meIdx > 0 ? sorted[meIdx - 1] : null;
  const behind = meIdx >= 0 && meIdx < sorted.length - 1 ? sorted[meIdx + 1] : null;

  if (!me) {
    return (
      <Section title={league.name}>
        <Empty>Your entry isn&apos;t in this league&apos;s standings.</Empty>
      </Section>
    );
  }

  return (
    <Section title={league.name}>
      <TileRow>
        <Tile label="position" value={`${me.rank} of ${sorted.length}`} />
        <Tile
          label={ahead ? `behind ${firstName(ahead.playerName)}` : 'leading'}
          value={ahead ? signed(-(ahead.total - me.total), 0) : '—'}
          tone={ahead ? 'threat' : 'gain'}
        />
        <Tile
          label={behind ? `ahead of ${firstName(behind.playerName)}` : 'last'}
          value={behind ? signed(me.total - behind.total, 0) : '—'}
          tone={behind ? 'gain' : 'threat'}
        />
      </TileRow>
    </Section>
  );
}

async function ExpectedSwing({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  const tone =
    model.expectedSwingTotal > 0.5
      ? 'gain'
      : model.expectedSwingTotal < -0.5
        ? 'threat'
        : 'plain';
  return (
    <TileRow>
      <Tile
        label={`expected vs league · GW${model.targetGw}`}
        value={signed(model.expectedSwingTotal)}
        tone={tone}
        sub={`${model.rivalCount} rivals · exposure as of GW${model.asOfGw}`}
      />
    </TileRow>
  );
}

async function ThreatList({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  const names = rivalNameMap(model.rivals);
  const rows = model.players
    .filter((p) => p.netEO < 0 && p.rivalEO > 0)
    .map((p) => toRow(p, names))
    .sort((a, b) => b.expectedDamage - a.expectedDamage)
    .slice(0, 12);

  if (rows.length === 0) return <Empty>No live threats — the league mostly mirrors you.</Empty>;
  const maxSwing = Math.max(...rows.map((r) => Math.abs(r.swing)), 0.1);

  return (
    <ul>
      {rows.map((r) => (
        <Row key={r.playerId} row={r} rivalCount={model.rivalCount} maxSwing={maxSwing} />
      ))}
    </ul>
  );
}

async function DifferentialList({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  const names = rivalNameMap(model.rivals);
  const rows = model.players
    .filter((p) => p.myEO > 0 && p.netEO > 0)
    .map((p) => toRow(p, names))
    .sort((a, b) => b.swing - a.swing)
    .slice(0, 10);

  if (rows.length === 0) return <Empty>You have no positive differentials in the league right now.</Empty>;
  const maxSwing = Math.max(...rows.map((r) => Math.abs(r.swing)), 0.1);

  return (
    <ul>
      {rows.map((r) => (
        <Row key={r.playerId} row={r} rivalCount={model.rivalCount} maxSwing={maxSwing} />
      ))}
    </ul>
  );
}

async function Captaincy({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  if (model.captaincy.length === 0) return <Empty>No captaincy data for GW{model.asOfGw}.</Empty>;

  const max = Math.max(...model.captaincy.map((c) => c.count), 1);
  return (
    <ul className="divide-y divide-line">
      {model.captaincy.map((c) => (
        <li key={c.playerId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="w-28 truncate">
            {c.webName}
            {c.isMyCaptain && <span className="ml-1 text-xs text-gain">(mine)</span>}
          </span>
          <span className="relative h-2.5 flex-1 rounded-sm bg-line">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-threat"
              style={{ width: `${(c.count / max) * 100}%` }}
            />
          </span>
          <span className="tnum text-xs text-muted">
            {c.count} of {model.rivalCount}
          </span>
        </li>
      ))}
    </ul>
  );
}

async function AsOf({ leagueId }: { leagueId: string }) {
  const model = await getExposureModel(leagueId);
  return <>as of GW{model.asOfGw}</>;
}

function SwingSkeleton() {
  return (
    <div className="flex border-y border-line bg-surface">
      <div className="flex-1 px-4 py-3">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton mt-2 h-6 w-16" />
      </div>
    </div>
  );
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}
