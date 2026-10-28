# Movie Verse

Movie Verse is a movie-discovery frontend built with the Next.js App Router. It
includes discovery, search, genre browsing, movie details, an about page, and a
personal favorites list stored in the visitor's browser.

## Run locally

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and add a TMDB API key.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

The TMDB key is read only by server-side route handlers. Do not prefix it with
`NEXT_PUBLIC_` or commit an environment file. If you have used a TMDB key that
was committed previously, revoke it and create a replacement.

## Commands

- `npm run dev` — start the Next.js development server.
- `npm run build` — create a production build.
- `npm start` — serve the production build.
- `npm run lint` — run the Next.js ESLint configuration.

Movie data and artwork are provided by [The Movie Database](https://www.themoviedb.org/).
Favorites are saved locally in the current browser and are not synced between devices.
