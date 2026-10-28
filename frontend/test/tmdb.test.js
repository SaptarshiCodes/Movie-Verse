import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getMovie,
  getMovieCollection,
  getMovieDetails,
  TmdbError,
} from "../src/lib/tmdb.js";

const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalApiKey = process.env.TMDB_API_KEY;
const originalBaseUrl = process.env.TMDB_BASE_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalApiKey === undefined) delete process.env.TMDB_API_KEY;
  else process.env.TMDB_API_KEY = originalApiKey;
  if (originalBaseUrl === undefined) delete process.env.TMDB_BASE_URL;
  else process.env.TMDB_BASE_URL = originalBaseUrl;
});

function configureTmdb(
  t,
  fetchImplementation,
  {
    apiKey = "test-key",
    baseUrl = "https://tmdb.example/3",
    logs = null,
  } = {},
) {
  process.env.NODE_ENV = "test";
  process.env.TMDB_API_KEY = apiKey;
  process.env.TMDB_BASE_URL = baseUrl;
  globalThis.fetch = fetchImplementation;
  for (const method of ["info", "warn", "error"]) {
    t.mock.method(console, method, (entry) => {
      if (logs) logs.push(JSON.parse(entry));
    });
  }
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("builds search, genre discovery, and popular requests with the expected parameters", async (t) => {
  const requests = [];
  configureTmdb(t, async (input, options) => {
    requests.push({ url: new URL(input), options });
    return jsonResponse({ results: [] });
  });

  await getMovieCollection({ query: "Spider-Man: No Way Home", page: 2 });
  await getMovieCollection({ genre: "27", page: 3 });
  await getMovieCollection({ page: 1 });

  assert.equal(requests[0].url.pathname, "/3/search/movie");
  assert.equal(requests[0].url.searchParams.get("query"), "Spider-Man: No Way Home");
  assert.equal(requests[0].url.searchParams.get("page"), "2");
  assert.equal(requests[0].url.searchParams.get("include_adult"), "true");
  assert.equal(requests[0].url.searchParams.get("api_key"), "test-key");
  assert.equal(requests[0].options.next.revalidate, 1800);
  assert.equal(requests[1].url.pathname, "/3/discover/movie");
  assert.equal(requests[1].url.searchParams.get("with_genres"), "27");
  assert.equal(requests[1].url.searchParams.get("include_adult"), "true");
  assert.equal(requests[2].url.pathname, "/3/movie/popular");
  assert.equal(requests[2].url.searchParams.has("include_adult"), false);
});

test("retries transient network failures and returns the successful response", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    if (calls < 3) throw new TypeError("fetch failed");
    return jsonResponse({ id: 42, title: "Recovered" });
  });

  const movie = await getMovie(42);

  assert.equal(calls, 3);
  assert.equal(movie.title, "Recovered");
});

test("maps provider status codes and does not retry non-transient failures", async (t) => {
  for (const [providerStatus, expectedStatus, expectedCalls] of [
    [404, 404, 1],
    [429, 429, 1],
    [401, 503, 1],
    [403, 503, 1],
    [500, 502, 3],
  ]) {
    let calls = 0;
    configureTmdb(t, async () => {
      calls += 1;
      return jsonResponse({}, providerStatus);
    });

    await assert.rejects(getMovie(42), (error) => {
      assert.ok(error instanceof TmdbError);
      assert.equal(error.status, expectedStatus);
      return true;
    });
    assert.equal(calls, expectedCalls, `provider status ${providerStatus}`);
  }
});

test("rejects an invalid TMDB base URL before making a request", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    return jsonResponse({});
  }, { baseUrl: "http://tmdb.example/3" });

  await assert.rejects(getMovie(42), (error) => {
    assert.ok(error instanceof TmdbError);
    assert.equal(error.status, 500);
    return true;
  });
  assert.equal(calls, 0);
});

test("allows a loopback HTTP TMDB base URL for local fixtures", async (t) => {
  let requestUrl;
  configureTmdb(t, async (input) => {
    requestUrl = new URL(input);
    return jsonResponse({ id: 42, title: "Local fixture" });
  }, { baseUrl: "http://127.0.0.1:3101/3" });

  const movie = await getMovie(42);

  assert.equal(movie.title, "Local fixture");
  assert.equal(requestUrl.origin, "http://127.0.0.1:3101");
});

test("falls back to core movie data when expanded details remain unavailable", async (t) => {
  const requests = [];
  const logs = [];
  configureTmdb(t, async (input) => {
    const url = new URL(input);
    requests.push(url);
    if (url.searchParams.has("append_to_response")) return jsonResponse({}, 502);
    return jsonResponse({ id: 42, title: "Core movie" });
  }, { logs });

  const movie = await getMovieDetails(42);

  assert.equal(movie.title, "Core movie");
  assert.equal(requests.length, 4);
  assert.equal(requests.slice(0, 3).every((url) => url.searchParams.has("append_to_response")), true);
  assert.equal(requests[3].searchParams.has("append_to_response"), false);
  assert.equal(logs.some((entry) => entry.event === "tmdb.details_fallback"), true);
  assert.equal(logs.every((entry) => !("movieId" in entry)), true);
});

test("logs successful request timing and status without URL, API key, or search terms", async (t) => {
  const logs = [];
  configureTmdb(t, async () => jsonResponse({ results: [] }), {
    apiKey: "sensitive-api-key-value",
    baseUrl: "https://private-provider-host.example/3",
    logs,
  });

  await getMovieCollection({ query: "private search phrase", page: 2 });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, "tmdb.request");
  assert.equal(logs[0].operation, "movie_search");
  assert.equal(logs[0].outcome, "success");
  assert.equal(logs[0].status, 200);
  assert.equal(logs[0].attempts, 1);
  assert.equal(logs[0].retryCount, 0);
  assert.equal(Number.isInteger(logs[0].durationMs), true);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("sensitive-api-key-value"), false);
  assert.equal(serializedLogs.includes("private-provider-host.example"), false);
  assert.equal(serializedLogs.includes("private search phrase"), false);
});

test("logs recovered retries with a safe network error code", async (t) => {
  let calls = 0;
  const logs = [];
  configureTmdb(t, async () => {
    calls += 1;
    if (calls < 3) {
      throw Object.assign(new TypeError("fetch failed with sensitive details"), {
        cause: Object.assign(new Error("socket reset"), { code: "ECONNRESET" }),
      });
    }
    return jsonResponse({ id: 42 });
  }, { logs });

  await getMovie(42);

  assert.equal(logs.length, 1);
  assert.equal(logs[0].operation, "movie_details");
  assert.equal(logs[0].outcome, "success");
  assert.equal(logs[0].status, 200);
  assert.equal(logs[0].attempts, 3);
  assert.equal(logs[0].retryCount, 2);
  assert.equal(logs[0].errorName, "TypeError");
  assert.equal(logs[0].errorCode, "ECONNRESET");
  assert.equal(JSON.stringify(logs).includes("sensitive details"), false);
});

test("logs exhausted provider failures with mapped and provider statuses", async (t) => {
  const logs = [];
  configureTmdb(t, async () => jsonResponse({ message: "provider detail" }, 500), {
    apiKey: "sensitive-api-key-value",
    logs,
  });

  await assert.rejects(getMovieCollection({ query: "secret title" }), { status: 502 });

  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, "tmdb.request");
  assert.equal(logs[0].operation, "movie_search");
  assert.equal(logs[0].outcome, "error");
  assert.equal(logs[0].status, 500);
  assert.equal(logs[0].appStatus, 502);
  assert.equal(logs[0].attempts, 3);
  const serializedLogs = JSON.stringify(logs);
  assert.equal(serializedLogs.includes("sensitive-api-key-value"), false);
  assert.equal(serializedLogs.includes("secret title"), false);
  assert.equal(serializedLogs.includes("provider detail"), false);
});
