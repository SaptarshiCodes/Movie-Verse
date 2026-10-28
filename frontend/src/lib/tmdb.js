const TMDB_API_BASE = "https://api.themoviedb.org/3";

export class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
  }
}

function getApiKey() {
  const key = process.env.TMDB_API_KEY || process.env.VITE_API_KEY;
  if (!key) throw new TmdbError("TMDB_API_KEY is not configured.", 503);
  return key;
}

async function requestTmdb(path, parameters = {}) {
  const url = new URL(`${TMDB_API_BASE}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const status = response.status === 404 || response.status === 429
      ? response.status
      : response.status === 401 || response.status === 403
        ? 503
        : 502;
    throw new TmdbError("The movie data provider returned an error.", status);
  }
  return response.json();
}

export function getMovieCollection({ query = "", page = 1, genre = "" }) {
  const endpoint = query ? "/search/movie" : genre ? "/discover/movie" : "/movie/popular";
  return requestTmdb(endpoint, {
    query: query || undefined,
    with_genres: genre || undefined,
    page,
    include_adult: "false",
    language: "en-US",
  });
}

export function getMovie(id) {
  return requestTmdb(`/movie/${id}`, { language: "en-US" });
}
