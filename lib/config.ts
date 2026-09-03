/**
 * Runtime configuration, read once from environment variables.
 *
 * This is a single-user app: the entry ID and the primary league ID are not
 * user input, they are deployment config. Everything here is server-only.
 */

function readInt(name: string, value: string | undefined): number {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required env var ${name}. Set it in .env.local (see .env.example).`,
    );
  }
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Env var ${name} must be a positive integer, got "${value}".`);
  }
  return n;
}

export interface AppConfig {
  /** My FPL team / entry ID (from the URL on the points page). */
  entryId: number;
  /** The mini-league this app is actually about. */
  primaryLeagueId: number;
  /** Shared secret guarding the cron routes. Empty string = crons disabled. */
  cronSecret: string;
  /**
   * Optional cap on how many rivals to fetch, counting outward from my row in
   * the standings. Undefined = every entry in the league. Useful for large
   * leagues where fanning out to everyone is wasteful.
   */
  rivalWindow: number | undefined;
  /** A desktop UA string. FPL sometimes rejects requests without one. */
  userAgent: string;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    entryId: readInt('FPL_ENTRY_ID', process.env.FPL_ENTRY_ID),
    primaryLeagueId: readInt(
      'FPL_PRIMARY_LEAGUE_ID',
      process.env.FPL_PRIMARY_LEAGUE_ID,
    ),
    cronSecret: process.env.CRON_SECRET?.trim() ?? '',
    rivalWindow: process.env.FPL_RIVAL_WINDOW
      ? readInt('FPL_RIVAL_WINDOW', process.env.FPL_RIVAL_WINDOW)
      : undefined,
    userAgent:
      process.env.FPL_USER_AGENT?.trim() ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };
  return cached;
}
