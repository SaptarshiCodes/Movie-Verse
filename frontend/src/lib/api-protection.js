import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const CLIENT_WINDOW_SECONDS = 60;
const UPSTREAM_WINDOW_SECONDS = 1;
const redisLimiters = new Map();
const memoryWindows = new Map();
let redis;
let localFallbackWarningShown = false;

function getPositiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function getRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error("Both Upstash Redis environment variables are required.");
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("Upstash Redis must use HTTPS without embedded credentials.");
  }
  redis ??= new Redis({ url: parsedUrl.toString(), token });
  return redis;
}

function getClientIdentifier(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const address = forwardedFor?.split(",")[0].trim();
  if (!address && process.env.NODE_ENV !== "production") return "local";
  if (!address || !isIP(address)) return null;
  return createHmac(
    "sha256",
    process.env.UPSTASH_REDIS_REST_TOKEN || "movie-verse-local-rate-limit",
  ).update(address).digest("hex");
}

export function createMemoryRateLimiter({ now = Date.now } = {}) {
  const windows = new Map();
  return (key, limit, windowSeconds) => {
    const currentTime = now();
    const resetAt = Math.floor(currentTime / (windowSeconds * 1000)) * (windowSeconds * 1000)
      + windowSeconds * 1000;
    const current = windows.get(key);
    const count = current?.resetAt === resetAt ? current.count : 0;
    const success = count < limit;

    if (success) windows.set(key, { count: count + 1, resetAt });
    if (windows.size > 1000) {
      for (const [entryKey, value] of windows) {
        if (value.resetAt <= currentTime) windows.delete(entryKey);
      }
    }

    return {
      success,
      limit,
      remaining: Math.max(0, limit - count - (success ? 1 : 0)),
      reset: resetAt,
    };
  };
}

const getMemoryLimit = createMemoryRateLimiter();

function getLimiter(name, limit, windowSeconds, sharedRedis) {
  const key = `${name}:${limit}:${windowSeconds}`;
  if (!redisLimiters.has(key)) {
    redisLimiters.set(key, new Ratelimit({
      redis: sharedRedis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      analytics: true,
      prefix: `movie-verse:${name}`,
      timeout: 1000,
      ephemeralCache: new Map(),
    }));
  }
  return redisLimiters.get(key);
}

async function checkLimit(name, identifier, limit, windowSeconds) {
  const sharedRedis = getRedisClient();
  if (!sharedRedis) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Upstash Redis must be configured before production API requests are served.");
    }
    if (!localFallbackWarningShown) {
      console.warn(JSON.stringify({
        event: "api.rate_limit_local_fallback",
        message: "Local in-memory limits are single-instance only; configure Upstash for production.",
      }));
      localFallbackWarningShown = true;
    }
    return getMemoryLimit(`${name}:${identifier}`, limit, windowSeconds);
  }

  const result = await getLimiter(name, limit, windowSeconds, sharedRedis).limit(identifier);
  if (result.reason === "timeout") {
    throw new Error("Upstash rate-limit request timed out.");
  }
  await result.pending;
  return result;
}

function parseDailyBudget() {
  const budget = Number(process.env.TMDB_DAILY_REQUEST_BUDGET || "10000");
  if (!Number.isSafeInteger(budget) || budget < 1) {
    throw new Error("TMDB_DAILY_REQUEST_BUDGET must be a positive integer.");
  }
  const threshold = Number(process.env.TMDB_QUOTA_ALERT_THRESHOLD || "0.8");
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error("TMDB_QUOTA_ALERT_THRESHOLD must be greater than 0 and at most 1.");
  }
  return { budget, threshold };
}

async function incrementDailyUsage(sharedRedis, budget) {
  const date = new Date().toISOString().slice(0, 10);
  const key = `movie-verse:tmdb:daily:${date}`;
  const result = await sharedRedis.eval(
    "local current = tonumber(redis.call('GET', KEYS[1]) or '0'); "
      + "if current >= tonumber(ARGV[1]) then return {current, 0} end; "
      + "local used = redis.call('INCR', KEYS[1]); "
      + "if used == 1 then redis.call('EXPIRE', KEYS[1], 172800) end; "
      + "return {used, 1}",
    [key],
    [String(budget)],
  );
  if (!Array.isArray(result) || result.length !== 2) {
    throw new Error("Upstash returned an invalid TMDB usage counter response.");
  }
  return { date, used: Number(result[0]), allowed: Number(result[1]) === 1 };
}

async function logQuotaWarning(sharedRedis, date, used, budget, threshold) {
  if (used < Math.ceil(budget * threshold)) return;
  const claimed = await sharedRedis.set(
    `movie-verse:tmdb:alert:${date}`,
    "1",
    { ex: 172800, nx: true },
  );
  if (claimed === "OK") {
    console.warn(JSON.stringify({
      event: "tmdb.quota_warning",
      window: "utc_day",
      used,
      budget,
      threshold,
    }));
  }
}

async function logQuotaExhausted(sharedRedis, date, used, budget) {
  const claimed = await sharedRedis.set(
    `movie-verse:tmdb:exhausted:${date}`,
    "1",
    { ex: 172800, nx: true },
  );
  if (claimed === "OK") {
    console.error(JSON.stringify({
      event: "tmdb.quota_exhausted",
      window: "utc_day",
      used,
      budget,
    }));
  }
}

export async function checkMovieApiRateLimit(request) {
  const identifier = getClientIdentifier(request);
  if (!identifier) {
    console.error(JSON.stringify({
      event: "api.client_ip_unavailable",
      platform: process.env.VERCEL ? "vercel" : "unknown",
    }));
    return { success: false, status: 503, reason: "client_ip_unavailable" };
  }

  try {
    const result = await checkLimit(
      "api:client",
      identifier,
      getPositiveInteger("MOVIE_API_REQUEST_LIMIT_PER_MINUTE", 60),
      CLIENT_WINDOW_SECONDS,
    );
    return { ...result, status: result.success ? 200 : 429 };
  } catch (error) {
    console.error(JSON.stringify({
      event: "api.rate_limit_unavailable",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }));
    return { success: false, status: 503, reason: "rate_limit_unavailable" };
  }
}

export async function reserveTmdbRequest() {
  try {
    const sharedRedis = getRedisClient();
    if (!sharedRedis && process.env.NODE_ENV === "production") {
      throw new Error("Upstash Redis must be configured before production API requests are served.");
    }

    const { budget, threshold } = parseDailyBudget();
    const upstreamRequestLimit = getPositiveInteger("TMDB_UPSTREAM_REQUEST_LIMIT_PER_SECOND", 30);
    const upstreamLimit = await checkLimit(
      "tmdb:upstream",
      "global",
      upstreamRequestLimit,
      UPSTREAM_WINDOW_SECONDS,
    );
    if (!upstreamLimit.success) {
      return {
        allowed: false,
        status: 429,
        retryAfter: Math.max(1, Math.ceil((upstreamLimit.reset - Date.now()) / 1000)),
        reason: "upstream_burst_limit",
      };
    }

    if (!sharedRedis) {
      const daily = getMemoryLimit(
        "tmdb:daily",
        budget,
        24 * 60 * 60,
      );
      if (!daily.success) {
        return { allowed: false, status: 429, retryAfter: 60, reason: "daily_budget" };
      }
      return { allowed: true };
    }

    const usage = await incrementDailyUsage(sharedRedis, budget);
    await logQuotaWarning(sharedRedis, usage.date, usage.used, budget, threshold);
    if (!usage.allowed) {
      await logQuotaExhausted(sharedRedis, usage.date, usage.used, budget);
      return {
        allowed: false,
        status: 429,
        retryAfter: Math.max(1, Math.ceil((Date.parse(`${usage.date}T24:00:00Z`) - Date.now()) / 1000)),
        reason: "daily_budget",
      };
    }
    return { allowed: true };
  } catch (error) {
    console.error(JSON.stringify({
      event: "tmdb.quota_monitoring_unavailable",
      errorName: error instanceof Error ? error.name : "UnknownError",
    }));
    return { allowed: false, status: 503, reason: "quota_monitoring_unavailable" };
  }
}

export function rateLimitResponse(result) {
  const status = result.status === 429 ? 429 : 503;
  const headers = new Headers({ "Cache-Control": "no-store" });
  const retryAfter = result.retryAfter
    || (result.reset ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) : undefined);
  if (status === 429 && retryAfter) {
    headers.set("Retry-After", String(retryAfter));
  }
  if (status === 429 && result.limit) {
    headers.set("X-RateLimit-Limit", String(result.limit));
    headers.set("X-RateLimit-Remaining", String(result.remaining));
    headers.set("X-RateLimit-Reset", String(Math.ceil(result.reset / 1000)));
  }
  return Response.json({
    error: status === 429
      ? "Too many movie requests. Please wait before trying again."
      : "Movie service protection is temporarily unavailable.",
  }, { status, headers });
}
