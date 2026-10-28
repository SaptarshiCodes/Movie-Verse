import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  checkMovieApiRateLimit,
  createMemoryRateLimiter,
  rateLimitResponse,
  reserveTmdbRequest,
} from "../src/lib/api-protection.js";

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  dailyBudget: process.env.TMDB_DAILY_REQUEST_BUDGET,
};

afterEach(() => {
  for (const [name, value] of [
    ["NODE_ENV", originalEnvironment.nodeEnv],
    ["UPSTASH_REDIS_REST_URL", originalEnvironment.redisUrl],
    ["UPSTASH_REDIS_REST_TOKEN", originalEnvironment.redisToken],
    ["TMDB_DAILY_REQUEST_BUDGET", originalEnvironment.dailyBudget],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("enforces a fixed-window limit and resets at the next window", () => {
  let now = 1_000;
  const limit = createMemoryRateLimiter({ now: () => now });

  assert.equal(limit("client", 2, 60).success, true);
  assert.equal(limit("client", 2, 60).remaining, 0);
  const blocked = limit("client", 2, 60);
  assert.equal(blocked.success, false);
  assert.equal(blocked.remaining, 0);

  now = 60_001;
  assert.equal(limit("client", 2, 60).success, true);
});

test("returns retry metadata when a client exceeds the API request limit", async () => {
  process.env.NODE_ENV = "test";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const request = new Request("http://localhost/api/movies", {
    headers: { "x-forwarded-for": "203.0.113.73" },
  });

  let result;
  for (let requestNumber = 0; requestNumber < 61; requestNumber += 1) {
    result = await checkMovieApiRateLimit(request);
  }

  assert.equal(result.success, false);
  assert.equal(result.status, 429);
  const response = rateLimitResponse(result);
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  assert.equal(response.headers.get("x-ratelimit-limit"), "60");
  assert.equal(response.headers.get("x-ratelimit-remaining"), "0");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("enforces the local daily TMDB budget", async () => {
  process.env.NODE_ENV = "test";
  process.env.TMDB_DAILY_REQUEST_BUDGET = "1";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  assert.deepEqual(await reserveTmdbRequest(), { allowed: true });
  const denied = await reserveTmdbRequest();
  assert.equal(denied.allowed, false);
  assert.equal(denied.status, 429);
  assert.equal(denied.reason, "daily_budget");
});

test("fails closed in production when shared rate limiting is not configured", async (t) => {
  process.env.NODE_ENV = "production";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  t.mock.method(console, "error", () => {});

  const request = new Request("https://movie-verse.example/api/movies", {
    headers: { "x-forwarded-for": "203.0.113.74" },
  });
  const clientLimit = await checkMovieApiRateLimit(request);
  const upstreamQuota = await reserveTmdbRequest();
  const missingIp = await checkMovieApiRateLimit(
    new Request("https://movie-verse.example/api/movies"),
  );

  assert.equal(clientLimit.status, 503);
  assert.equal(missingIp.status, 503);
  assert.equal(upstreamQuota.allowed, false);
  assert.equal(upstreamQuota.status, 503);
  assert.equal(upstreamQuota.reason, "quota_monitoring_unavailable");

  process.env.UPSTASH_REDIS_REST_URL = "http://redis.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  const insecureRedis = await checkMovieApiRateLimit(request);
  assert.equal(insecureRedis.status, 503);
});
