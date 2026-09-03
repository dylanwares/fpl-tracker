import { Disclosure } from '@/components/Disclosure';
import { SortableSquadTable } from '@/components/SortableSquadTable';
import { Empty, Section, Tile, TileRow } from '@/components/ui';
import { ValueLeaderboard } from '@/components/ValueLeaderboard';
import { getScoutData, type ScoutPlayer } from '@/lib/scout';

export const dynamic = 'force-dynamic';

export default async function ScoutPage() {
  const s = await getScoutData();

  return (
    <div className="pb-4">
      <p className="px-4 pt-4 text-xs text-muted">
        Overall-game context, separate from the league tables. &ldquo;Template&rdquo;
        is the most-selected valid squad by global ownership — a rough proxy for
        the real thing.
      </p>

      <Section title="My squad at a glance" aside={`GW${s.asOfGw}`}>
        <SortableSquadTable rows={s.mySquad.all} />
      </Section>

      <Section title="Template comparison">
        <TileRow>
          <Tile
            label="template XI match"
            value={`${s.template.xiOverlap} of 11`}
            tone={
              s.template.xiOverlap >= 8
                ? 'plain'
                : s.template.xiOverlap >= 6
                  ? 'plain'
                  : 'threat'
            }
            sub={`${Math.round(s.template.xiDistance * 100)}% template`}
          />
          <Tile
            label="off-template picks"
            value={s.template.offTemplate.length}
            sub="your global differentials"
          />
          <Tile
            label="template you're missing"
            value={s.template.missing.length}
          />
        </TileRow>

        <div className="border-b border-line">
          <p className="px-4 pt-3 text-xs text-muted">Template XI</p>
          <PlayerGrid rows={s.template.xi} />
        </div>

        <Disclosure summary={<span className="text-sm">Full template 15</span>}>
          <PlayerGrid rows={s.template.squad} dense />
        </Disclosure>

        <div className="border-b border-line">
          <p className="px-4 pt-3 text-xs text-muted">
            Template players you don&apos;t own
          </p>
          {s.template.missing.length === 0 ? (
            <Empty>You have the entire template XI.</Empty>
          ) : (
            <PlayerList rows={s.template.missing} />
          )}
        </div>

        <div>
          <p className="px-4 pt-3 text-xs text-muted">
            Your off-template starters
          </p>
          {s.template.offTemplate.length === 0 ? (
            <Empty>Your XI is the template XI.</Empty>
          ) : (
            <PlayerList rows={s.template.offTemplate} />
          )}
        </div>
      </Section>

      <Section title="Value leaderboard" aside="points per £m">
        <ValueLeaderboard pool={s.pool} />
      </Section>
    </div>
  );
}

function PlayerGrid({
  rows,
  dense = false,
}: {
  rows: ScoutPlayer[];
  dense?: boolean;
}) {
  const groups: Record<string, ScoutPlayer[]> = { GKP: [], DEF: [], MID: [], FWD: [] };
  for (const p of rows) groups[p.position]?.push(p);

  return (
    <div className={dense ? 'pb-3' : 'pb-3'}>
      {(['GKP', 'DEF', 'MID', 'FWD'] as const).map((pos) =>
        groups[pos].length ? (
          <div key={pos} className="px-4 pt-2">
            <span className="text-xs text-muted">{pos}</span>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {groups[pos].map((p) => (
                <span key={p.id}>
                  {p.webName}
                  <span className="ml-1 text-xs text-muted tnum">
                    {p.selectedByPercent.toFixed(0)}%
                  </span>
                  {p.iOwn && <span className="ml-0.5 text-xs text-gain">✓</span>}
                </span>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function PlayerList({ rows }: { rows: ScoutPlayer[] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-3 px-4 py-2"
        >
          <span className="truncate">
            <span className="text-xs text-muted">
              {p.position} {p.teamShort}
            </span>{' '}
            {p.webName}
          </span>
          <span className="flex shrink-0 items-center gap-3 tnum text-xs text-muted">
            <span>{p.selectedByPercent.toFixed(0)}% own</span>
            <span>£{p.price.toFixed(1)}</span>
            <span className="text-text">{p.totalPoints} pts</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
