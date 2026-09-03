import { MiniBars } from '@/components/MiniBars';
import { Empty, Section, Tile, TileRow } from '@/components/ui';
import { getTeamAnalysis } from '@/lib/analysis';
import { signed } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AnalysisPage() {
  const a = await getTeamAnalysis();

  if (a.asOfGw === 0) {
    return (
      <Section title="Analysis">
        <Empty>No gameweeks played yet.</Empty>
      </Section>
    );
  }

  const pvaValues = a.pointsVsAverage.map((r) => r.delta);
  const pvaLabels = a.pointsVsAverage.map((r) => r.gameweek);
  const finalPva = a.pointsVsAverage.at(-1)?.cumulativeDelta ?? 0;

  return (
    <div className="pb-4">
      <Section title="Points vs average" aside={`through GW${a.asOfGw}`}>
        <div className="px-4 py-3">
          <MiniBars values={pvaValues} labels={pvaLabels} />
        </div>
        <TileRow>
          <Tile
            label="cumulative"
            value={signed(finalPva, 0)}
            tone={finalPva >= 0 ? 'gain' : 'threat'}
            sub="points above the average manager"
          />
          <Tile
            label="best GW"
            value={signed(Math.max(...pvaValues), 0)}
            tone="gain"
          />
          <Tile
            label="worst GW"
            value={signed(Math.min(...pvaValues), 0)}
            tone="threat"
          />
        </TileRow>
      </Section>

      <Section title="Captaincy">
        <TileRow>
          <Tile
            label="points lost"
            value={a.captaincy.totalLoss}
            tone={a.captaincy.totalLoss > 0 ? 'threat' : 'gain'}
            sub="best starter minus captain, each GW"
          />
          <Tile
            label="vice > captain"
            value={`${a.captaincy.viceOutscoredCount}x`}
          />
          <Tile
            label="armband on top"
            value={`${a.captaincy.armbandOnTopCount}/${a.captaincy.perGw.length}`}
          />
        </TileRow>
        <ul className="divide-y divide-line text-sm">
          {a.captaincy.perGw
            .filter((c) => c.loss > 0)
            .sort((x, y) => y.loss - x.loss)
            .map((c) => (
              <li
                key={c.gameweek}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span className="tnum text-muted">GW{c.gameweek}</span>
                <span className="flex-1 truncate">
                  {c.captainName} ({c.captainRaw}) · best {c.bestName} (
                  {c.bestRaw})
                </span>
                <span className="tnum text-threat">−{c.loss}</span>
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Bench">
        <TileRow>
          <Tile
            label="points wasted"
            value={a.bench.totalWasted}
            tone="threat"
            sub="left on the bench, after auto-subs"
          />
          <Tile
            label="per GW"
            value={(a.bench.totalWasted / Math.max(1, a.bench.perGw.length)).toFixed(1)}
          />
        </TileRow>
        <ul className="divide-y divide-line text-sm">
          {a.bench.perGw
            .filter((b) => b.wastedPoints > 0)
            .sort((x, y) => y.wastedPoints - x.wastedPoints)
            .slice(0, 8)
            .map((b) => (
              <li
                key={b.gameweek}
                className="flex items-center justify-between gap-3 px-4 py-2"
              >
                <span className="tnum text-muted">GW{b.gameweek}</span>
                <span className="flex-1 truncate text-muted">
                  {b.players
                    .filter((p) => p.points > 0)
                    .map((p) => `${p.name} ${p.points}`)
                    .join(', ')}
                </span>
                <span className="tnum text-threat">−{b.wastedPoints}</span>
              </li>
            ))}
        </ul>
      </Section>

      <Section title="Transfers">
        <TileRow>
          <Tile
            label="net ROI"
            value={signed(a.transfers.seasonNetRoi)}
            tone={a.transfers.seasonNetRoi >= 0 ? 'gain' : 'threat'}
            sub="points gained vs players sold, minus hits"
          />
          <Tile
            label="gross ROI"
            value={signed(a.transfers.seasonGrossRoi)}
            tone={a.transfers.seasonGrossRoi >= 0 ? 'gain' : 'threat'}
          />
          <Tile label="hits" value={`−${a.hits.total}`} tone="threat" />
        </TileRow>
        <ul className="divide-y divide-line text-sm">
          {a.transfers.perGw.map((g) => (
            <li key={g.gameweek} className="px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="tnum text-muted">
                  GW{g.gameweek}
                  {g.chip ? ` · ${g.chip}` : ''}
                </span>
                <span
                  className={`tnum ${g.netRoi >= 0 ? 'text-gain' : 'text-threat'}`}
                >
                  {signed(g.netRoi)}
                  {g.hit > 0 && (
                    <span className="text-muted"> (−{g.hit} hit)</span>
                  )}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">
                {g.moves
                  .map(
                    (m) =>
                      `${m.outName} → ${m.inName} ${signed(m.roi, 0)} over ${m.windowGws}GW`,
                  )
                  .join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
