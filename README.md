# FPL Personal Tracker

A single-user Fantasy Premier League planning dashboard. No auth, no
multi-tenancy — the entry ID and league ID come from environment variables.

**Primary goal: winning one specific mini-league.** The two headline features
are *threats* (players my rivals have that I don't) and *differentials* (players
I have that they don't), both measured **within the league** via a shared
`exposure` primitive. Overall rank is a single readout on `/team`, nowhere else.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · deployed on Vercel.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in FPL_ENTRY_ID and FPL_PRIMARY_LEAGUE_ID
npm run dev
```

`FPL_ENTRY_ID` is the number in your points-page URL
(`fantasy.premierleague.com/entry/<THIS>/event/1`). `FPL_PRIMARY_LEAGUE_ID` is
the number in the classic-league standings URL. No secrets are needed to read
FPL data — every endpoint used here is public.

Without `KV_*` vars the app uses an in-memory / `.data/*.json` store, so it runs
locally with no external account. Snapshots and price history just won't persist
across serverless instances until KV is configured (see Deployment).

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server (Turbopack) on :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Typecheck |

---

## How it works

### Data flow

The FPL API sends no CORS headers, so **every call goes through the server**.
`lib/fpl/client.ts` is the one fetch wrapper: a `User-Agent` header, per-endpoint
`revalidate` TTLs, one retry on 5xx, and defensive parsing that treats a non-JSON
body as downtime rather than a bug. `/bootstrap-static/` (~2.3 MB) exceeds Next's
data-cache ceiling, so it's memoised in-process (`lib/memo.ts`) instead.

Pages are Server Components that call `lib/*` directly. The internal API routes
under `app/api/` are thin wrappers returning the same normalised data as an
`ApiEnvelope<T>` — handy for manual inspection and future clients, not used by
the pages themselves.

### The exposure primitive (`lib/exposure.ts`)

For a player `p` and an entry `e`, `exposure(p, e)` is that entry's scoring
multiplier: `0` not owned / benched, `1` starting XI, `2` captain, `3` triple
captain (Bench Boost weeks: every one of the 15 counts ≥ 1). Then:

```
rivalEO(p) = Σ exposure(p, e) / N     over the N rivals
myEO(p)    = exposure(p, me)
netEO(p)   = myEO(p) − rivalEO(p)          negative = threat, positive = differential
swing(p)   = netEO(p) × projectedPoints(p)
```

`lib/exposure-model.ts` does this once per request (memoised with `React.cache`);
`/threats`, `/differentials`, `/captaincy` and `/gap` are cheap projections over
its output.

### The pre-deadline blackout

Rival squads for the **upcoming** gameweek are unknowable until the deadline
passes — this is deliberate on FPL's part and there is no workaround. Exposure is
therefore always computed from the **last resolved gameweek**, and every table is
stamped "as of GW{n}". Tables are most accurate right after a deadline and drift
through the week. Captaincy especially: last GW's distribution reads as the
league's *habits*, not a prediction.

One known rough edge: a rival's one-shot chip from the resolved GW (Triple
Captain, Bench Boost) is carried into the forward projection as if still active,
which overstates that rival's threat for the coming week. The retrospective
`/review` diff is unaffected.

### Projection (`lib/projection.ts`)

Deliberately crude and isolated behind one function so it can be improved later:
`pointsPerGame × formAdjustment × fixtureAdjustment × availabilityAdjustment`.
Since threats and differentials are ranked with the same function, systematic
bias mostly cancels. Doubles sum both fixtures; blanks are zero.

### Downtime

FPL takes the game offline after each deadline while it processes the gameweek.
`lib/fpl/status.ts` exposes `getGameStatus() → 'live' | 'updating' | 'unavailable'`,
checked at the top of every route and both crons. When it isn't `live`: serve
cached data, show the banner, **skip all writes**. Force it locally for testing
with `FPL_FORCE_STATUS=updating`.

### Persistence (`lib/store/`)

The API keeps no history for standings, resolved rival picks or price movement.
Two cron routes capture what we want to look back on:

| Route | Schedule (`vercel.json`, UTC) | Captures |
|---|---|---|
| `/api/cron/snapshot` | `0 22 * * 1` — Mon ~23:00 UK (BST) | Standings, resolved rival picks + captains, resolved exposure |
| `/api/cron/prices` | `0 1 * * *` — daily ~02:00 UK (BST) | Price-change deltas for the player pool |

Both require `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this
automatically when `CRON_SECRET` is set). Keys: `league:{id}:gw:{n}`,
`prices:{date}`. The snapshot cron also verifies the gameweek is `finished &&
data_checked` before writing. **Schedules are UTC** — nudge both by an hour when
the UK leaves BST.

The deadline diff on `/review` needs two stored snapshots, so it appears only
after the snapshot cron has run twice.

---

## Deployment (Vercel)

1. Push to a Git remote and import the repo in Vercel.
2. Set env vars: `FPL_ENTRY_ID`, `FPL_PRIMARY_LEAGUE_ID`, `CRON_SECRET`
   (`openssl rand -hex 32`).
3. Add **Vercel KV** (Marketplace → Upstash Redis). It provisions
   `KV_REST_API_URL` / `KV_REST_API_TOKEN`. If it only gives
   `UPSTASH_REDIS_REST_*`, alias them or swap `lib/store/kv.ts` for
   `@upstash/redis` — the `Store` interface is the seam.
4. `vercel.json` registers the two crons automatically.

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Planning dashboard — league position + gap, expected swing, threats, differentials, captaincy concentration |
| `/leagues/[id]` | Standings, rival squads as of last deadline, chips remaining |
| `/team` | My squad, price changes, flags, fixture ticker, overall rank, transfer scratchpad |
| `/analysis` | Luck vs decisions: points vs average, captaincy loss, bench waste, transfer ROI, hits |
| `/review` | Last gameweek — what the league changed at the deadline and its netEO impact |

Out of scope (V1): live points / live rank (the official app does this well),
generated advice, and overall-rank tooling (template distance, top-10k, global
ownership).
