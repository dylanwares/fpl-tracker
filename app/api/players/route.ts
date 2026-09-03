import type { NextRequest } from 'next/server';

import { envelope, runRoute } from '@/lib/api';
import { fetchBootstrap } from '@/lib/fpl/endpoints';
import { normaliseBootstrap } from '@/lib/fpl/normalise';
import { getGameStatus } from '@/lib/fpl/status';
import type { Player, Position } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SORTS: Record<string, (a: Player, b: Player) => number> = {
  points: (a, b) => b.totalPoints - a.totalPoints,
  form: (a, b) => b.form - a.form,
  price: (a, b) => b.price - a.price,
  ownership: (a, b) => b.selectedByPercent - a.selectedByPercent,
  ppg: (a, b) => b.pointsPerGame - a.pointsPerGame,
};

export function GET(req: NextRequest) {
  return runRoute(async () => {
    const gameStatus = await getGameStatus();
    const sp = req.nextUrl.searchParams;

    const q = (sp.get('q') ?? '').trim().toLowerCase();
    const position = sp.get('position')?.toUpperCase() as Position | undefined;
    const team = sp.get('team')?.toUpperCase();
    const maxPrice = Number.parseFloat(sp.get('maxPrice') ?? '');
    const sortKey = sp.get('sort') ?? 'points';
    const limit = Math.min(
      Math.max(Number.parseInt(sp.get('limit') ?? '50', 10) || 50, 1),
      200,
    );

    const bs = normaliseBootstrap(await fetchBootstrap());
    let players = [...bs.players.values()];

    if (q) {
      players = players.filter(
        (p) =>
          p.webName.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q),
      );
    }
    if (position && ['GKP', 'DEF', 'MID', 'FWD'].includes(position)) {
      players = players.filter((p) => p.position === position);
    }
    if (team) players = players.filter((p) => p.teamShort.toUpperCase() === team);
    if (Number.isFinite(maxPrice)) {
      players = players.filter((p) => p.price <= maxPrice);
    }

    players.sort(SORTS[sortKey] ?? SORTS.points);

    return envelope(
      { count: players.length, players: players.slice(0, limit) },
      { gameStatus },
    );
  });
}
