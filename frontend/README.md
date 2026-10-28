# Movie Verse

Movie Verse is a movie-discovery frontend built with the Next.js App Router. It
includes discovery, search, genre browsing, movie details, an about page, and a
personal favorites list stored in the visitor's browser.

## Run locally

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local`, then set `TMDB_API_KEY`. The
   `TMDB_BASE_URL` defaults to `https://api.themoviedb.org/3`.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

Both TMDB settings are read only by server-side route handlers. Do not prefix
them with `NEXT_PUBLIC_` or commit an environment file. If you have used a TMDB
key that was committed previously, revoke it and create a replacement.

Production API protection also requires an Upstash Redis database. Set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local` and in
Vercel's project environment. Production movie API requests fail closed with
503 if those credentials or the trusted client IP are unavailable; local
development uses a clearly logged, per-process fallback.

Page responses use a fresh CSP nonce for Next.js scripts. This requires
request-time rendering, so app pages are not statically prerendered. API routes
and static assets are excluded from the nonce proxy. Production script execution
does not allow `unsafe-inline`; inline style attributes remain enabled for the
dynamic movie backdrops. Development additionally allows the eval and WebSocket
connections required by Next.js tooling.

The default limits are 60 movie API requests per client per minute, 30 upstream
TMDB requests per second, and an app-owned budget of 10,000 TMDB requests per
UTC day. The daily budget is a protective application setting, not a TMDB quota;
set it below the usage agreed for your TMDB key. A once-daily structured
`tmdb.quota_warning` event is emitted at the configured threshold (80% by
default), and `tmdb.quota_exhausted` is emitted when the budget is reached.
Use Vercel Logs to create an alert for those event names and for
`tmdb.provider_rate_limited`. Upstash rate-limit analytics tracks accepted and
blocked client requests. Tune the settings with
`MOVIE_API_REQUEST_LIMIT_PER_MINUTE`, `TMDB_UPSTREAM_REQUEST_LIMIT_PER_SECOND`,
`TMDB_DAILY_REQUEST_BUDGET`, and `TMDB_QUOTA_ALERT_THRESHOLD`.

## Commands

- `npm run dev` — start the Next.js development server.
- `npm run build` — create a production build.
- `npm start` — serve the production build.
- `npm run lint` — run the Next.js ESLint configuration.
- `npm test` — run unit tests with Node.js's built-in test runner.
- `npm run test:e2e` — run browser smoke tests against deterministic TMDB fixtures.

For browser tests, install Chromium once with `npx playwright install chromium`.
The E2E suite starts the app with a local TMDB fixture service, so it does not
require a live TMDB connection or real API key. `TMDB_BASE_URL` accepts plain
HTTP only for loopback hosts to support local development and test fixtures;
all other custom provider URLs must use HTTPS.

TMDB request logs are emitted as structured JSON lines with operation, outcome,
status, retry count, and duration. They intentionally omit request URLs, API
keys, search terms, and movie IDs.

Movie data and artwork are provided by [The Movie Database](https://www.themoviedb.org/).
Favorites are saved locally in the current browser and are not synced between devices.
Adult titles are included in TMDB search and genre-discovery results. TMDB's movie
details endpoint does not accept an age flag; it returns details for the requested ID.
