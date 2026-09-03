import { getConfig } from '@/lib/config';

export type CronAuth =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET env var is set. We also accept it as `?secret=` for manual runs.
 */
export function checkCronAuth(req: Request): CronAuth {
  const { cronSecret } = getConfig();
  if (!cronSecret) {
    return {
      ok: false,
      status: 503,
      message: 'CRON_SECRET is not configured; cron routes are disabled.',
    };
  }
  const header = req.headers.get('authorization') ?? '';
  const url = new URL(req.url);
  const provided =
    header.replace(/^Bearer\s+/i, '') || url.searchParams.get('secret') || '';

  if (provided !== cronSecret) {
    return { ok: false, status: 401, message: 'Bad or missing cron secret.' };
  }
  return { ok: true };
}
