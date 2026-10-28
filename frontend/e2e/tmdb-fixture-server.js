import { createServer } from "node:http";

const port = Number(process.env.PORT || 3101);

const fixtureMovie = {
  id: 9006,
  title: "Fixture Feature",
  original_title: "Fixture Feature",
  overview: "A small fixture story used to verify the movie detail experience.",
  tagline: "A story made for reliable tests.",
  poster_path: null,
  backdrop_path: null,
  release_date: "2025-01-15",
  original_language: "en",
  runtime: 112,
  vote_average: 8.1,
  vote_count: 320,
  status: "Released",
  budget: 12_000_000,
  revenue: 28_000_000,
  genres: [{ id: 12, name: "Adventure" }, { id: 18, name: "Drama" }],
  production_countries: [{ iso_3166_1: "US", name: "United States of America" }],
  production_companies: [{ id: 9001, name: "Fixture Pictures" }],
  spoken_languages: [{ english_name: "English", name: "English" }],
  credits: {
    cast: [{
      id: 9002,
      cast_id: 1,
      credit_id: "fixture-cast-credit",
      name: "Test Actor",
      character: "The Explorer",
      profile_path: null,
    }],
    crew: [{
      id: 9003,
      credit_id: "fixture-director-credit",
      name: "Test Director",
      job: "Director",
    }],
  },
  reviews: {
    page: 1,
    results: [{
      id: "fixture-review",
      author: "Fixture Reviewer",
      content: "A concise review for the browser smoke test.",
      created_at: "2025-01-20T12:00:00.000Z",
      url: "https://www.themoviedb.org/review/fixture-review",
      author_details: { rating: 8 },
    }],
    total_pages: 1,
    total_results: 1,
  },
  recommendations: { page: 1, results: [], total_pages: 1, total_results: 0 },
  videos: { results: [] },
};
const popularMovies = Array.from({ length: 6 }, (_, index) => ({
  ...fixtureMovie,
  id: 9100 + index,
  title: `Popular Fixture ${index + 1}`,
  poster_path: null,
  vote_average: 7.5,
}));
const requestCounts = new Map();

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const path = url.pathname.replace(/^\/3/, "");

  if (path === "/healthz") {
    response.writeHead(200);
    response.end("ok");
    return;
  }

  if (path === "/__stats") {
    sendJson(response, { requests: Object.fromEntries(requestCounts) });
    return;
  }

  if (path === "/__stats/reset" && request.method === "POST") {
    requestCounts.clear();
    sendJson(response, { reset: true });
    return;
  }

  const requestKey = path + (url.searchParams.has("append_to_response")
    ? `?append_to_response=${url.searchParams.get("append_to_response")}`
    : "");
  requestCounts.set(requestKey, (requestCounts.get(requestKey) || 0) + 1);

  if (path === "/movie/popular") {
    sendJson(response, { page: 1, results: popularMovies, total_pages: 1, total_results: popularMovies.length });
    return;
  }

  if (path === "/search/movie") {
    const query = (url.searchParams.get("query") || "").toLowerCase();
    const results = query.includes("fixture") ? [fixtureMovie] : [];
    sendJson(response, { page: 1, results, total_pages: 1, total_results: results.length });
    return;
  }

  if (path === `/movie/${fixtureMovie.id}`) {
    sendJson(response, fixtureMovie);
    return;
  }

  const cacheMeasurementId = path.startsWith("/movie/")
    ? Number(path.slice("/movie/".length))
    : 0;
  if (Number.isSafeInteger(cacheMeasurementId) && cacheMeasurementId >= 1_000_000_000_000) {
    sendJson(response, {
      ...fixtureMovie,
      id: cacheMeasurementId,
      title: `Cache Measurement ${cacheMeasurementId}`,
      original_title: `Cache Measurement ${cacheMeasurementId}`,
    });
    return;
  }

  if (/^\/movie\/\d+$/.test(path)) {
    sendJson(response, { status_message: "The requested resource could not be found." }, 404);
    return;
  }

  sendJson(response, { status_message: "Fixture endpoint not found." }, 404);
});

server.listen(port, "127.0.0.1");
