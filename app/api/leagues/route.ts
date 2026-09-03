import { envelope, runRoute } from '@/lib/api';
import { getConfig } from '@/lib/config';
import { getGameStatus } from '@/lib/fpl/status';
import { getLeague } from '@/lib/league';

export const dynamic = 'force-dynamic';

export function GET() {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const { primaryLeagueId, entryId } = getConfig();
    const league = await getLeague(primaryLeagueId);

    const me = league.standings.find((s) => s.entryId === entryId) ?? null;

    return envelope(
      [
        {
          id: league.id,
          name: league.name,
          primary: true,
          size: league.standings.length,
          myRank: me?.rank ?? null,
          myTotal: me?.total ?? null,
          leader: league.standings[0] ?? null,
          standings: league.standings,
        },
      ],
      { gameStatus },
    );
  });
}
