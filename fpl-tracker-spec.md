# FPL Personal Tracker — Build Spec

A single-user Fantasy Premier League dashboard. No auth, no multi-tenancy — entry ID and
league IDs come from environment variables.

**Primary goal: winning one specific mini-league.** Overall rank is a secondary readout,
not the optimisation target. Every metric that can be framed relative to the league
should be — global ownership, global rank and the top-10k template are context, not
signal. The two headline features are *threats* (players my rivals have and I don't) and
*differentials* (players I have and they don't), both measured within the league.

**Stack:** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.

> Verify every upstream endpoint and field name against a live response before building
> around it. The FPL API is undocumented and field names shift between seasons.

---

## 1. Configuration

```
FPL_ENTRY_ID=89353          # your team ID (from the URL on your points page)
FPL_PRIMARY_LEAGUE_ID=52740  # the league this app is actually about
CRON_SECRET=                  # guards the snapshot route
```

No secrets are needed to read FPL data — all endpoints used here are public.

---

## 2. Upstream endpoints

Base: `https://fantasy.premierleague.com/api`

| Endpoint | Purpose | Cache TTL |
|---|---|---|
| `/bootstrap-static/` | All players, teams, gameweek metadata, prices, status flags | 1 hour |
| `/fixtures/` | Full season fixtures + difficulty ratings | 12 hours |
| `/entry/{entryId}/` | Team name, overall rank, squad value, bank | 1 hour |
| `/entry/{entryId}/history/` | Per-GW history, chips used — **mine and every rival's** | 6 hours |
| `/entry/{entryId}/event/{gw}/picks/` | Squad for a settled GW, captain, auto-subs | 6 hours |
| `/entry/{entryId}/transfers/` | My transfers this season; rivals' only once resolved | 1 hour |
| `/leagues-classic/{leagueId}/standings/` | Mini-league table (paginated) | 6 hours |
| `/element-summary/{elementId}/` | Per-player fixture + history detail | 12 hours |
| `/event-status/` | Whether the game is mid-update — see Downtime | no cache |

No live endpoint. `/event/{gw}/live/` and live standings are deliberately out of scope —
the official app already does that well. This app is for the days *between* gameweeks.

### CORS

The FPL API sends no CORS headers. **All calls must go through server-side route
handlers.** Never fetch it from the browser.

### Fetch wrapper

Build one `lib/fpl/client.ts` with:
- A `User-Agent` header set (requests without one are sometimes rejected)
- `next: { revalidate: n }` per the table above
- Retry once on 5xx with a short backoff
- A typed response per endpoint, parsed at the boundary — do not pass raw upstream JSON
  into components

---

## 3. Domain model

Normalise upstream shapes into these. Keep them in `lib/types.ts`.

```ts
type Position = 'GKP' | 'DEF' | 'MID' | 'FWD';

interface Player {
  id: number;
  webName: string;
  fullName: string;
  teamId: number;
  teamShort: string;
  position: Position;
  price: number;            // in millions, e.g. 8.5 (upstream stores tenths)
  totalPoints: number;
  form: number;
  pointsPerGame: number;
  selectedByPercent: number;
  xG: number;
  xA: number;
  xGI90: number;
  expectedGoalsConceded: number;
  status: 'a' | 'd' | 'i' | 's' | 'u';  // available/doubtful/injured/suspended/unavailable
  chanceOfPlaying: number | null;
  news: string;
  priceChangeEvent: number;  // net transfers-based delta this GW
}

interface Team {
  id: number;
  name: string;
  shortName: string;
  strengthAttackHome: number;
  strengthAttackAway: number;
  strengthDefenceHome: number;
  strengthDefenceAway: number;
}

interface Fixture {
  id: number;
  gameweek: number | null;   // null = unscheduled
  kickoff: string | null;    // ISO
  homeTeamId: number;
  awayTeamId: number;
  homeDifficulty: number;    // 1-5
  awayDifficulty: number;
  finished: boolean;
}

interface Pick {
  playerId: number;
  position: number;          // 1-15, squad slot order
  multiplier: number;        // 0 bench, 1 starter, 2 captain, 3 triple captain
  isCaptain: boolean;
  isViceCaptain: boolean;
  points: number;            // raw points before multiplier
}

interface GameweekEntry {
  gameweek: number;
  points: number;            // after multipliers, after hits
  pointsOnBench: number;
  rank: number | null;       // GW rank
  overallRank: number | null;
  transfers: number;
  transferCost: number;
  squadValue: number;
  bank: number;
  chip: ChipName | null;
  picks: Pick[];
  automaticSubs: { inId: number; outId: number }[];
}

type ChipName = 'wildcard' | 'freehit' | 'bboost' | '3xc';

interface Transfer {
  gameweek: number;
  inPlayerId: number;
  outPlayerId: number;
  inCost: number;
  outCost: number;
  time: string;
}

interface LeagueStanding {
  entryId: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number;
  total: number;
  gameweekPoints: number;
}

interface League {
  id: number;
  name: string;
  standings: LeagueStanding[];
}
```

---

## 4. Derived metrics

These are the point of the app. Define them precisely; they are easy to get subtly wrong.

### Bench points wasted
Sum of `points` for players with `multiplier === 0` **after** auto-subs are applied.
A player auto-subbed on is not wasted. Bench Boost weeks are zero by definition.

### Captaincy loss
```
captainRaw = points of the captained player (before multiplier)
bestRaw    = max raw points among the 11 players who actually started
loss       = max(0, bestRaw - captainRaw)
```
Report per GW and as a season total. Also track: how often the vice-captain outscored
the captain, and how often the armband was on the highest scorer.

### Transfer ROI
For each transfer of player OUT → player IN at gameweek `g`:
```
window = gameweeks from g until IN is transferred out (or the current GW)
roi    = (IN points over window) - (OUT points over window)
```
Sum across all transfers in a gameweek, then subtract that GW's `transferCost` for a net
figure. Season total answers: *has my transfer activity actually gained me points?*
Ignore Wildcard and Free Hit gameweeks in the totals, or flag them separately —
they distort the number badly.

### Hits taken
Season sum of `transferCost`. Present alongside transfer ROI so the two read together.

### Points vs average
`points - averageEntryScore` per GW, cumulative. A cleaner progress signal than raw rank
because it is not distorted by the size of the player base.

### Exposure — the shared primitive

Threats and differentials are the same calculation with opposite signs. Compute exposure
once and derive both views from it.

For any player `p` and any entry `e`, exposure is that entry's scoring multiplier:

```
exposure(p, e) = 0  not owned, or on the bench
                 1  in the starting XI
                 2  captained
                 3  triple-captained
```

Bench Boost weeks are the exception: every one of the 15 counts as at least 1.

Across the N **rival** entries in the league (everyone except me):

```
rivalEO(p) = Σ exposure(p, e) / N        // 0 to 3, usually 0 to 1.2
myEO(p)    = exposure(p, me)             // 0, 1, 2 or 3
netEO(p)   = myEO(p) - rivalEO(p)
```

`netEO` is the whole game in one number:

- **Negative** → a threat. Every point this player scores costs me ground.
- **Positive** → a differential. Every point gains me ground.
- **Near zero** → irrelevant to the league, however well he plays.

Expected rank swing for the gameweek:

```
swing(p) = netEO(p) × projectedPoints(p)
```

Summing `swing(p)` across all players gives an expected points-vs-league figure for the
gameweek. That single number is the best "am I about to gain or lose ground" indicator
in the app.

### Most dangerous players

Rank by `rivalEO(p)` descending, restricted to players where `myEO(p) === 0`, or where
`netEO(p) < 0` if you want to include players you own but rivals have captained.

Table columns: player, team, fixture + difficulty, `rivalEO`, my exposure, `netEO`,
projected points, expected damage (`-netEO × projectedPoints`).

Two sort modes, both worth having:
- **By ownership** — raw `rivalEO`, "who is everyone else backing"
- **By expected damage** — `rivalEO × projectedPoints`, "who actually hurts me this week"

They diverge usefully: a 90%-owned defender with a hard away fixture is widely owned but
not especially dangerous this week.

Also surface **captaincy concentration** separately: the distribution of who the league
has captained. If eight of ten rivals captain the same player and you don't, that single
choice dominates the gameweek regardless of anything else in your squad.

### Best differentials in my squad

Players where `myEO(p) > 0` and `rivalEO(p)` is low, ranked by `netEO(p) × projectedPoints(p)`.

Table columns: player, fixture, `rivalEO`, my exposure, `netEO`, projected points,
expected gain, and how many rivals own him (raw count reads better than a percentage in
a ten-man league).

Two things to make explicit in the UI:

- A differential is only a differential *in this league*. A globally low-owned player
  that three of your nine rivals happen to own is not one. Never show global ownership
  on this table — it invites the wrong conclusion.
- Flag your **negative differentials**: players in your XI that most of the league also
  owns and captains. These are not helping you win the league; they are just keeping you
  level. Useful when deciding what to sell.

### Projected points

None of the above works without a projection. There is no official one in the API, so
isolate it in `lib/projection.ts` behind a single function so it can be improved later:

```ts
projectedPoints(player, fixture) =
  pointsPerGame
  × formAdjustment          // blend season PPG with last-5 form
  × fixtureAdjustment       // from opponent difficulty, home/away
  × availabilityAdjustment  // chanceOfPlaying / 100, 0 if status !== 'a'
```

Crude, but consistent — and since threats and differentials are both ranked with the
same function, systematic bias mostly cancels out. Doubles get the sum of both fixtures;
blanks get zero.

### Gap analysis

For each rival within striking distance, the swing available this gameweek is the sum of
`swing(p)` computed against that single rival rather than the whole league. Surface the
two or three players who most determine the outcome, and the points gap to close.

### Deadline diff

Once a deadline passes and rival picks resolve, diff them against the stored previous
gameweek to show every transfer the league made, with each move's `netEO` impact. This is
retrospective, not a live feed — it tells you what the league did, and it is the first
thing worth looking at when the blackout lifts.

**Chips remaining per rival** comes from each rival's `history` payload, which lists chips
already used. Past usage is visible at any time; a chip played for the current gameweek
only appears once the deadline has passed. A rival with Bench Boost or Triple Captain
still in hand changes what a sensible move looks like for you.

### Template distance
Percentage of your starting XI that appears in the most-selected XI among the top ranks
you can sample. Without top-10k data, approximate using the highest-owned player at each
position from `bootstrap-static`. Rough, but directionally useful.

---

## 5. Internal API routes

All under `app/api/`. Each returns normalised domain types, never raw upstream JSON.

```
GET  /api/gameweek/current          → current GW metadata, deadline, average score
GET  /api/team                      → entry summary + current squad with player detail
GET  /api/team/history              → GameweekEntry[] for the season
GET  /api/team/analysis             → bench waste, captaincy loss, transfer ROI, hits
GET  /api/team/fixtures?horizon=6   → per-owned-player fixture ticker with difficulty
GET  /api/leagues                   → all configured leagues, summary standings
GET  /api/leagues/[id]              → full standings + per-rival picks for current GW
GET  /api/leagues/[id]/exposure     → the shared primitive: rivalEO, myEO, netEO per player
GET  /api/leagues/[id]/threats      → dangerous players, both sort modes
GET  /api/leagues/[id]/differentials→ my differentials + negative differentials
GET  /api/leagues/[id]/captaincy    → captaincy distribution, last resolved GW
GET  /api/leagues/[id]/diff         → what the league changed at the last deadline
GET  /api/leagues/[id]/chips        → chips remaining per rival
GET  /api/leagues/[id]/gap/[rivalId]→ head-to-head swing vs one rival
GET  /api/players?filter=...        → searchable/filterable player pool
GET  /api/status                    → game status for the downtime banner
GET  /api/cron/snapshot             → protected; persists resolved picks after each GW
GET  /api/cron/prices               → protected; captures overnight price changes
```

`/exposure` does the expensive work; `/threats`, `/differentials`, `/captaincy` and
`/gap` are cheap projections over its output. Build it once and cache it.

Building the league costs two calls per rival — `picks` for the last completed gameweek
and `history` for chips. Fan these out with `Promise.all` and cap concurrency at ~5. Both
are immutable once the gameweek is resolved, so cache them hard: after the first fetch
following a deadline, they never change until the next one. For a large league, only
fetch rivals near you in the table.

### The pre-deadline blackout — the defining constraint

**Rival squads for the upcoming gameweek are unknowable until the deadline passes.** This
is deliberate on FPL's part, and there is no way around it: the picks endpoint serves the
last completed gameweek until the deadline, and in-progress transfers are not exposed
either. Do not build anything that assumes otherwise.

So exposure is always computed from **the last resolved gameweek**:

```
rivalEO(p) = Σ exposure(p, e) / N     // e's picks as of the last completed GW
```

Every threat and differential figure in the app is therefore "as of the last deadline".
Label it that way in the UI — a small "as of GW{n}" marker on each table is enough.

This is less limiting than it sounds. Most managers make zero or one transfer a week, so
last gameweek's squads are a strong prior for this week's. What it does mean:

- The tables are **most accurate right after a deadline passes**, and drift as the week
  goes on. That's the natural rhythm to build around: refresh after the deadline, plan
  against that baseline all week.
- Captaincy is the exception. It changes weekly and is only visible post-deadline, so
  treat last gameweek's captaincy distribution as an indication of the league's habits
  rather than a prediction — who the league tends to back, not who they will back.
- Never present the tables as showing rivals' current teams. They show rivals' *last
  known* teams.

There is no useful workaround, so don't spend effort looking for one. Build the honest
version.

---

## 6. Pages

```
/                    Planning dashboard — deadline countdown, league position and gap,
                     threat table, differential table, all stamped "as of GW{n}"
/leagues/[id]        Standings, rival squads as of last deadline, chips remaining
/team                My squad, price changes, flags, fixture ticker, transfer scratchpad
/analysis            Luck vs decisions: bench, captaincy, transfer ROI, points vs average
/review              Last gameweek — deadline diff, what the league did, what it cost me
```

The home page is the primary league mid-planning, not my team and not overall rank.
Overall rank appears as one figure on `/team`, nowhere else. There is no live view —
during matches, use the official app.

`/review` is the counterpart to the planning dashboard: it opens after a gameweek settles
and shows resolved exposure, so the loop is *plan → play → review → plan*.

---

## 7. Persistence and refresh cadence

The API gives no history for mini-league standings, resolved rival picks or price
movement — only current state. Anything you want to look back on, you must capture.

Two protected cron routes, both guarded by `CRON_SECRET` in an `Authorization` header:

| Route | Schedule | Captures |
|---|---|---|
| `/api/cron/snapshot` | Mon ~23:00 UK (after the GW settles) | Standings, resolved picks and captains for every rival, resolved exposure |
| `/api/cron/prices` | Daily ~02:00 UK | Price change deltas for the player pool |

Store as JSON blobs in Vercel KV — `league:{id}:gw:{n}` and `prices:{date}` — or a single
Postgres table each if you prefer SQL. Everything else is derived on demand.

Run the snapshot late Monday rather than at the final whistle: bonus points, auto-subs
and final standings take an hour or two to settle after the last match.

### What updates when

Nothing is pushed. Data refreshes on page load once its cache expires, or when a cron
runs. Effective staleness by state of the week:

- **Mon–Fri (main use):** prices refresh overnight; injury news and status flags within
  the hour; rival transfers within 30 minutes of being made. Everything else is
  effectively static, which is why long TTLs cost nothing here.
- **Deadline day:** transfer activity spikes, so `/exposure` is worth revalidating more
  often — a 10-minute TTL in the final hours is reasonable.
- **Post-deadline:** fetch resolved picks once, store them, done.
- **During matches:** the app is not for this. Nothing needs to refresh.

Because you are the only user, whoever pays the cost of a cold cache is always you. With
long TTLs and only two crons, that means the occasional slow load midweek — acceptable
for a personal tool, and avoidable later by having the snapshot cron warm the cache.

### Downtime — required behaviour

FPL takes the game offline for a period after each deadline while it processes the
gameweek, and the API becomes unreliable or unavailable during that window. Data pulled
mid-processing can be partial or inconsistent, so **the app must never write to the
database while the game is updating.**

Detect it two ways and treat either as downtime:

1. **Status endpoint.** `/api/event-status/` reports whether league data has finished
   updating — check the leagues field for an "Updating" state rather than "Updated".
   Confirm the exact shape against a live response; this is the intended signal but the
   payload is undocumented.
2. **Hard failure.** A 503, a non-JSON body, or an HTML maintenance page from any
   endpoint. Parse defensively — assume any unexpected content type means downtime, not a
   bug in your code.

Wrap this in `lib/fpl/status.ts` exposing a single `getGameStatus()` returning
`'live' | 'updating' | 'unavailable'`, and check it at the top of every route handler.

Required behaviour when the status is not `live`:

- **Serve cached data only.** Render the last known good state from KV, stamped with the
  gameweek it came from.
- **Display a banner** across the app: the game is updating, figures are from GW{n} and
  may be out of date.
- **Skip all writes.** Both cron routes exit early with a 200 and a logged no-op — do not
  snapshot, do not record price changes, do not overwrite anything. A partial snapshot is
  worse than a missing one, because the following week's diff is computed against it.
- **Do not retry in a loop.** Fail the request, show the banner, let the next scheduled
  run pick it up.

The snapshot cron should also verify the gameweek it is about to store is actually
finished — check the `finished` and `data_checked` flags on the event in
`bootstrap-static` — and exit early if not. Scheduling it late Monday makes this rare, but
it is the guard that stops a bad write.

---

## 8. Interface

Phone first. Desktop is the same layout with more breathing room, not a different one.
Single user, so there is no onboarding, no marketing surface, no settings screen, and no
empty state for a first-time user — configuration lives in env vars.

### Design direction

The subject is signed exposure: every player is a position that is either working for me
or against me. Build the whole interface around a **zero-anchored axis**. Each row carries
a bar that extends right for a differential and left for a threat, all sharing one centre
line down the list, so the shape of the league reads before any number does. Spend the
boldness there and keep everything else quiet.

Palette derives from the game's own colours rather than a neutral dark theme:

```
--bg        #1C1421   deep aubergine-black, from FPL's purple
--surface   #241A2B   rows, sheets
--line      #362A3F   hairlines, the zero axis
--text      #F0EBF2
--muted     #9B8FA6   secondary figures, labels
--gain      #00E585   differentials
--threat    #F0883E   threats — amber, not red, so gain/threat stays
                      distinguishable for colour-blind viewing
```

Dark by default. Most use is evenings and late midweek, and it keeps the two accent
colours doing the heavy lifting.

Never encode meaning in colour alone. Sign, bar direction and colour all carry it
together.

One typeface, a grotesque with real tabular figures — Geist or Public Sans both work.
Set `font-variant-numeric: tabular-nums` everywhere a number sits in a column, so figures
align down the list and changes between gameweeks don't shift the layout. This is not the
same as using a monospace face for labels; don't do that.

### The row

Tables with eight columns do not work on a 390px screen. Every table in section 4 becomes
a list of rows instead:

```
┌──────────────────────────────────────────┐
│ Haaland          MCI          h BUR (2)  │
│ 7 of 9 own, 3 captain    ◀████     −2.4  │
├──────────────────────────────────────────┤
│ Gakpo            LIV          a BHA (3)  │
│ 1 of 9 own               ██▶      +1.1   │
└──────────────────────────────────────────┘
```

Line one is identity: player, club, fixture with difficulty. Line two is the position:
raw ownership on the left in muted text, the diverging bar in the middle, the signed
expected swing on the right at the largest size in the row. That number is what the row
is for.

Tap a row to expand in place: full `netEO` breakdown, which rivals own him, price, form,
status flag, next five fixtures. No navigation away, no modal.

### Navigation and structure

Bottom tab bar, five destinations, thumb-reachable. Sticky header on the planning
dashboard showing the deadline countdown and the "as of GW{n}" stamp, since almost every
figure in the app depends on both.

Order screens by what a midweek session actually needs: threats first, then
differentials, then the standings, then my own squad. The threat list is the reason the
app is open.

### Speed

The cold-cache fan-out is the one slow path, so structure around it:

- Server Components throughout. No client-side data fetching, no loading spinners driven
  by `useEffect`.
- Stream with Suspense boundaries: the shell, deadline countdown and standings render
  immediately from cheap calls; the exposure tables stream in behind them.
- Skeleton rows must match final row height exactly. Layout shift on a phone is what makes
  an app feel slow even when it isn't.
- Render the last stored snapshot from KV instantly, then revalidate. Stale data on screen
  beats an empty screen, as long as the stamp is honest about its age.
- Add a web app manifest so it opens from the home screen without browser chrome. For a
  tool used two or three times a week from a phone, this is most of the perceived polish.
- A manual refresh control in the header, since TTLs are long by design and you will
  sometimes want to force it.

### Copy

Sentence case, no labels above content that the content already explains. Two states need
writing properly:

- **Downtime:** name what is happening and what is on screen. "FPL is updating. Showing
  data from GW7." Not an apology, not a spinner.
- **Fetch failure:** say which part failed and that the rest is still current, rather than
  replacing the whole page with an error.

Respect `prefers-reduced-motion`. The only motion worth having is the row expand, which
shows what changed.

---

## 9. Build order

1. **Skeleton** — FPL client, types, `getGameStatus()` and the downtime banner,
   `/api/gameweek/current`, `/api/team`. Also the shell: tokens, bottom nav, sticky
   header, one row component. Build downtime handling in from the start; it is painful to
   retrofit into every route later.
2. **League fetch** — standings, fan-out of picks + history per rival for the last
   resolved gameweek, concurrency cap, caching. Unglamorous, but everything below depends
   on it.
3. **Exposure** — `rivalEO`, `myEO`, `netEO`, the projection function. One endpoint.
4. **Threats and differentials** — the two headline tables, plus captaincy distribution
   and expected swing. This is the app.
5. **Snapshots** — both cron routes with the downtime and `data_checked` guards, KV
   storage, resolved exposure and price history.
6. **Deadline diff and chips** — cheap once steps 2 and 5 exist, and the first thing
   worth reading when the blackout lifts.
7. **Analysis and review** — bench waste, captaincy loss, transfer ROI, `/review`.

That is V1. Ship 1–4 before touching anything else. Steps 2 and 3 are the only genuinely
hard parts; once exposure is correct, most of the remaining features are table rendering.

### Explicitly out of scope for V1

- Live points and live rank — the official app covers it
- Generated advice or narrative summaries — revisit once the exposure and projection data
  has been trustworthy for a few gameweeks. Any layer like that is only as good as the
  numbers underneath it, so there is nothing to gain from building it early.
- Overall-rank tooling: template distance, top-10k comparisons, global ownership charts
