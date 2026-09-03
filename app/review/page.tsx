import { Disclosure } from '@/components/Disclosure';
import { Empty, Section, Tile, TileRow } from '@/components/ui';
import { chipLabel } from '@/lib/chips';
import { deadlineDiff } from '@/lib/diff';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { signed } from '@/lib/format';
import { getConfig } from '@/lib/config';
import { latestLeagueSnapshots } from '@/lib/store';
import { getMyHistory } from '@/lib/team';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const { primaryLeagueId } = getConfig();
  const [snaps, history, bs] = await Promise.all([
    latestLeagueSnapshots(primaryLeagueId, 2),
    getMyHistory(),
    fetchBootstrap().then(normaliseBootstrap),
  ]);

  const name = (id: number) => bs.players.get(id)?.webName ?? `#${id}`;
  const lastGw = history.at(-1);
  const prevGw = history.at(-2);

  return (
    <div className="pb-4">
      <Section title="Last gameweek">
        {lastGw ? (
          <TileRow>
            <Tile label={`GW${lastGw.gameweek} points`} value={lastGw.points} />
            <Tile
              label="overall rank"
              value={lastGw.overallRank ? lastGw.overallRank.toLocaleString() : '—'}
              sub={
                prevGw?.overallRank && lastGw.overallRank
                  ? `${signed(prevGw.overallRank - lastGw.overallRank, 0)} places`
                  : undefined
              }
            />
            <Tile
              label="hits"
              value={lastGw.transferCost ? `−${lastGw.transferCost}` : '0'}
              tone={lastGw.transferCost ? 'threat' : 'plain'}
            />
            <Tile
              label="bench"
              value={`−${lastGw.pointsOnBench}`}
              tone={lastGw.pointsOnBench > 0 ? 'threat' : 'plain'}
            />
          </TileRow>
        ) : (
          <Empty>No gameweek history yet.</Empty>
        )}
      </Section>

      {snaps.length < 2 ? (
        <Section title="What the league did">
          <Empty>
            Needs two stored gameweek snapshots. The snapshot cron captures one
            after each gameweek settles (~23:00 UK Monday) — the deadline diff
            appears once it has run twice.
          </Empty>
        </Section>
      ) : (
        (() => {
          const [curr, prev] = snaps;
          const diff = deadlineDiff(prev, curr);
          return (
            <>
              <Section
                title="What the league did"
                aside={`GW${diff.fromGw} → GW${diff.toGw}`}
              >
                {diff.rivals.filter(
                  (r) =>
                    r.inIds.length ||
                    r.chipsNewlyUsed.length ||
                    r.captainChange,
                ).length === 0 ? (
                  <Empty>The league stood pat — no transfers or chips.</Empty>
                ) : (
                  diff.rivals
                    .filter(
                      (r) =>
                        r.inIds.length ||
                        r.chipsNewlyUsed.length ||
                        r.captainChange,
                    )
                    .map((r) => (
                      <Disclosure
                        key={r.entryId}
                        summary={
                          <span className="flex-1 truncate">
                            {r.playerName}
                            <span className="ml-2 text-xs text-muted">
                              {r.inIds.length
                                ? `${r.inIds.length} transfer${r.inIds.length > 1 ? 's' : ''}`
                                : ''}
                              {r.chipsNewlyUsed.length
                                ? ` · ${r.chipsNewlyUsed.map(chipLabel).join(', ')}`
                                : ''}
                            </span>
                          </span>
                        }
                      >
                        <ul className="pt-2 text-sm">
                          {r.moves.map((m, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between gap-3 py-1"
                            >
                              <span className="truncate">
                                {m.outId ? name(m.outId) : '—'}{' '}
                                <span className="text-muted">→</span>{' '}
                                {name(m.inId)}
                              </span>
                              <span
                                className={`tnum text-xs ${
                                  m.netEoImpact >= 0
                                    ? 'text-gain'
                                    : 'text-threat'
                                }`}
                                title="effect on my net EO"
                              >
                                {signed(m.netEoImpact, 2)}
                              </span>
                            </li>
                          ))}
                          {r.captainChange && (
                            <li className="py-1 text-xs text-muted">
                              captain:{' '}
                              {r.captainChange.fromId
                                ? name(r.captainChange.fromId)
                                : '—'}{' '}
                              →{' '}
                              {r.captainChange.toId
                                ? name(r.captainChange.toId)
                                : '—'}
                            </li>
                          )}
                        </ul>
                      </Disclosure>
                    ))
                )}
              </Section>

              <Section title="Threats rising">
                {diff.rising.length === 0 ? (
                  <Empty>No rival exposure grew this deadline.</Empty>
                ) : (
                  <ul className="divide-y divide-line text-sm">
                    {diff.rising.map((s) => (
                      <li
                        key={s.playerId}
                        className="flex items-center justify-between gap-3 px-4 py-2"
                      >
                        <span className="truncate">{name(s.playerId)}</span>
                        <span className="tnum text-xs text-muted">
                          {s.rivalEoBefore.toFixed(2)} →{' '}
                          {s.rivalEoAfter.toFixed(2)}
                        </span>
                        <span className="tnum text-threat">
                          {signed(s.delta, 2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          );
        })()
      )}
    </div>
  );
}
