import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  handleMovieCollectionRequest,
  handleMovieDetailRequest,
} from "../src/lib/movie-route-handlers.js";

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

function configureTmdb(t, fetchImplementation, { apiKey = "test-key" } = {}) {
  process.env.NODE_ENV = "test";
  process.env.TMDB_API_KEY = apiKey;
  process.env.TMDB_BASE_URL = "https://tmdb.example/3";
  globalThis.fetch = fetchImplementation;
  for (const method of ["info", "warn", "error"]) {
    t.mock.method(console, method, () => {});
  }
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function collectionRequest(query = "") {
  return new Request(`http://localhost/api/movies${query}`, {
    headers: { "x-forwarded-for": "203.0.113.1" },
  });
}

test("rejects malformed collection inputs without calling TMDB", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    throw new Error("TMDB should not be called for invalid input");
  });

  const invalidQueries = [
    ["?query=" + "a".repeat(101), "Search must be 100 characters or fewer."],
    ["?page=0", "Page must be between 1 and 500."],
    ["?page=501", "Page must be between 1 and 500."],
    ["?page=1.5", "Page must be between 1 and 500."],
    ["?page=invalid", "Page must be between 1 and 500."],
    ["?genre=0", "Genre must be a positive numeric ID."],
    ["?genre=-1", "Genre must be a positive numeric ID."],
    ["?genre=123456", "Genre must be a positive numeric ID."],
  ];

  for (const [query, message] of invalidQueries) {
    const response = await handleMovieCollectionRequest(collectionRequest(query));
    assert.equal(response.status, 400, query);
    assert.deepEqual(await response.json(), { error: message }, query);
  }
  assert.equal(calls, 0);
});

test("returns collection results, forwards normalized inputs, and disables client caching", async (t) => {
  const requests = [];
  configureTmdb(t, async (input) => {
    requests.push(new URL(input));
    return jsonResponse({ page: 2, results: [{ id: 8, title: "Movie" }] });
  });

  const response = await handleMovieCollectionRequest(
    collectionRequest("?query=%20Insidious%20&page=2"),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await response.json(), { page: 2, results: [{ id: 8, title: "Movie" }] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].pathname, "/3/search/movie");
  assert.equal(requests[0].searchParams.get("query"), "Insidious");
  assert.equal(requests[0].searchParams.get("page"), "2");
  assert.equal(requests[0].searchParams.get("include_adult"), "true");
});

test("maps list-provider configuration and rate-limit errors to the expected responses", async (t) => {
  for (const [providerStatus, expectedStatus, expectedMessage] of [
    [401, 503, "Movie data is not configured. Add a server-side TMDB_API_KEY."],
    [429, 429, "Movie data is temporarily busy. Please try again shortly."],
  ]) {
    configureTmdb(t, async () => jsonResponse({}, providerStatus));
    const response = await handleMovieCollectionRequest(collectionRequest("?query=Alien"));
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), { error: expectedMessage });
  }

  configureTmdb(t, async () => {
    throw new Error("TMDB_API_KEY is not configured.");
  }, { apiKey: "" });
  const missingKeyResponse = await handleMovieCollectionRequest(collectionRequest());
  assert.equal(missingKeyResponse.status, 503);
  assert.deepEqual(await missingKeyResponse.json(), {
    error: "Movie data is not configured. Add a server-side TMDB_API_KEY.",
  });
});

test("maps exhausted upstream failures to a generic 502 response", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    return jsonResponse({}, 500);
  });

  const response = await handleMovieCollectionRequest(collectionRequest("?query=Alien"));

  assert.equal(calls, 3);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Movie data is temporarily unavailable." });
});

test("rejects invalid movie IDs without calling TMDB", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    throw new Error("TMDB should not be called for invalid IDs");
  });

  for (const id of ["0", "-2", "1.5", "9007199254740992", "not-a-number"]) {
    const response = await handleMovieDetailRequest(id);
    assert.equal(response.status, 400, id);
    assert.deepEqual(await response.json(), {
      error: "Movie ID must be a positive integer.",
    }, id);
  }
  assert.equal(calls, 0);
});

test("returns expanded movie details and maps not-found and provider failures", async (t) => {
  let requestUrl;
  configureTmdb(t, async (input) => {
    requestUrl = new URL(input);
    return jsonResponse({ id: 42, title: "The Movie", credits: { cast: [] } });
  });

  const success = await handleMovieDetailRequest("42");
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.deepEqual(await success.json(), {
    id: 42,
    title: "The Movie",
    credits: { cast: [] },
  });
  assert.equal(requestUrl.pathname, "/3/movie/42");
  assert.equal(requestUrl.searchParams.get("append_to_response"), "credits,reviews,recommendations,videos");

  configureTmdb(t, async () => jsonResponse({}, 404));
  const notFound = await handleMovieDetailRequest("999");
  assert.equal(notFound.status, 404);
  assert.deepEqual(await notFound.json(), { error: "Movie not found." });

  configureTmdb(t, async () => jsonResponse({}, 403));
  const forbidden = await handleMovieDetailRequest("42");
  assert.equal(forbidden.status, 503);
  assert.deepEqual(await forbidden.json(), {
    error: "Movie data is not configured. Add a server-side TMDB_API_KEY.",
  });
});

test("maps a detail network failure to a generic 502 response", async (t) => {
  let calls = 0;
  configureTmdb(t, async () => {
    calls += 1;
    throw new TypeError("fetch failed");
  });

  const response = await handleMovieDetailRequest("42");

  assert.equal(calls, 6);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Movie data is temporarily unavailable." });
});

test("returns a retry delay when the upstream provider rate-limits a request", async (t) => {
  configureTmdb(t, async () => ({
    ...jsonResponse({}, 429),
    headers: new Headers({ "retry-after": "9" }),
  }));

  const response = await handleMovieCollectionRequest(collectionRequest("?query=Alien"));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "9");
  assert.deepEqual(await response.json(), {
    error: "Movie data is temporarily busy. Please try again shortly.",
  });
});
