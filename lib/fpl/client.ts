/**
 * The one place the FPL API is called. Server-only: the FPL API sends no CORS
 * headers, so nothing here may run in the browser.
 */

import { getConfig } from '@/lib/config';

const BASE = 'https://fantasy.premierleague.com/api';

/**
 * Thrown when the API is unreachable or clearly mid-maintenance: a 503, a
 * non-JSON body (HTML holding page), or a network failure. Callers translate
 * this into GameStatus 'unavailable' and serve cached data.
 */
export class DowntimeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DowntimeError';
  }
}

/** Thrown for a genuine 4xx (bad entry id, private league, etc.). */
export class FplRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'FplRequestError';
  }
}

interface FetchOptions {
  /** seconds; passed to Next's fetch cache. Omit with noStore for always-fresh. */
  revalidate?: number;
  noStore?: boolean;
  /** cache tag(s) for on-demand revalidation */
  tags?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fplFetch<T>(
  path: string,
  { revalidate, noStore, tags }: FetchOptions = {},
): Promise<T> {
  const { userAgent } = getConfig();
  const url = path.startsWith('http') ? path : `${BASE}${path}`;

  const init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    headers: {
      'User-Agent': userAgent,
      Accept: 'application/json',
    },
  };
  if (noStore) {
    init.cache = 'no-store';
  } else {
    init.next = { revalidate: revalidate ?? 3600, tags };
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(400);
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      lastErr = err;
      continue; // network blip — retry once
    }

    if (res.status >= 500) {
      lastErr = new DowntimeError(`FPL ${path} returned ${res.status}`);
      if (res.status === 503) throw lastErr; // maintenance, no point retrying
      continue;
    }
    if (res.status >= 400) {
      throw new FplRequestError(
        `FPL ${path} returned ${res.status}`,
        res.status,
      );
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      // Holding page / Cloudflare challenge — treat as downtime, not a bug.
      throw new DowntimeError(
        `FPL ${path} returned non-JSON (${contentType || 'no content-type'})`,
      );
    }

    try {
      return (await res.json()) as T;
    } catch (err) {
      throw new DowntimeError(`FPL ${path} sent an unparseable body`, err);
    }
  }

  throw new DowntimeError(`FPL ${path} failed after retry`, lastErr);
}
