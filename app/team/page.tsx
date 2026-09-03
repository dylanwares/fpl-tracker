import { FixtureChip } from '@/components/FixtureChip';
import { TransferScratchpad } from '@/components/TransferScratchpad';
import { Empty, Section, Tile, TileRow } from '@/components/ui';
import { chipLabel } from '@/lib/chips';
import { price, signed, statusMeta } from '@/lib/format';
import { getMyFixtureTicker, getMyHistory, getMySquad } from '@/lib/team';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [squad, ticker, history] = await Promise.all([
    getMySquad(),
    getMyFixtureTicker(6),
    getMyHistory(),
  ]);

  const latest = history.at(-1);
  const start = squad.slots.filter((s) => s.pick.multiplier >= 1);
  const bench = squad.slots.filter((s) => s.pick.multiplier === 0);
  const tickerByPlayer = new Map(ticker.rows.map((r) => [r.player.id, r]));

  return (
    <div className="pb-4">
      <Section
        title={squad.entry.entryName}
        aside={
          squad.activeChip ? `chip: ${chipLabel(squad.activeChip)}` : undefined
        }
      >
        <TileRow>
          <Tile
            label="overall rank"
            value={
              squad.entry.overallRank
                ? squad.entry.overallRank.toLocaleString()
                : '—'
            }
          />
          <Tile label="squad value" value={price(squad.entry.squadValue)} />
          <Tile label="in the bank" value={price(squad.entry.bank)} />
          <Tile
            label={`GW${latest?.gameweek ?? ''} points`}
            value={latest?.points ?? '—'}
          />
        </TileRow>
      </Section>

      <Section title={`Starting XI · GW${squad.gameweek}`}>
        <SquadList
          slots={start}
          tickerByPlayer={tickerByPlayer}
        />
      </Section>

      <Section title="Bench">
        <SquadList slots={bench} tickerByPlayer={tickerByPlayer} />
      </Section>

      <Section title="Fixture ticker" aside={`next ${6} GWs`}>
        {ticker.rows.length === 0 ? (
          <Empty>No fixture data.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {[...ticker.rows]
              .sort((a, b) => b.averageDifficulty - a.averageDifficulty)
              .map((r) => (
                <li
                  key={r.player.id}
                  className="flex items-center gap-3 px-4 py-2 text-sm"
                >
                  <span className="w-24 truncate">{r.player.webName}</span>
                  <span className="flex flex-wrap gap-1">
                    {r.fixtures.map((f) => (
                      <FixtureChip
                        key={f.gameweek}
                        label={`${f.isHome ? '' : '@'}${f.opponentShort} ${f.difficulty}`}
                        difficulty={f.difficulty}
                        title={`GW${f.gameweek}`}
                      />
                    ))}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section title="Transfer scratchpad">
        <TransferScratchpad
          squad={squad.slots.map((s) => ({
            id: s.player.id,
            webName: s.player.webName,
            teamShort: s.player.teamShort,
            position: s.player.position,
            price: s.player.price,
          }))}
        />
      </Section>
    </div>
  );
}

function SquadList({
  slots,
  tickerByPlayer,
}: {
  slots: Awaited<ReturnType<typeof getMySquad>>['slots'];
  tickerByPlayer: Map<
    number,
    Awaited<ReturnType<typeof getMyFixtureTicker>>['rows'][number]
  >;
}) {
  return (
    <ul className="divide-y divide-line">
      {slots.map(({ pick, player }) => {
        const sm = statusMeta(player.status);
        const next = tickerByPlayer.get(player.id)?.fixtures[0];
        return (
          <li
            key={player.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <div className="flex items-baseline gap-2 truncate">
              <span className="w-6 text-xs text-muted">{player.position}</span>
              <span className="font-medium">{player.webName}</span>
              {pick.isCaptain && (
                <span className="text-xs text-gain">C</span>
              )}
              {pick.isViceCaptain && (
                <span className="text-xs text-muted">V</span>
              )}
              {sm.tone !== 'ok' && (
                <span
                  className="text-xs"
                  style={{
                    color:
                      sm.tone === 'bad' ? 'var(--threat)' : 'var(--muted)',
                  }}
                  title={player.news || sm.label}
                >
                  ● {sm.label}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3 tnum text-xs">
              {next && (
                <FixtureChip
                  label={`${next.isHome ? '' : '@'}${next.opponentShort} ${next.difficulty}`}
                  difficulty={next.difficulty}
                  title={`GW${next.gameweek}`}
                />
              )}
              {player.priceChangeEvent !== 0 && (
                <span
                  className={
                    player.priceChangeEvent > 0 ? 'text-gain' : 'text-threat'
                  }
                >
                  {signed(player.priceChangeEvent)}
                </span>
              )}
              <span className="text-muted">{price(player.price)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
