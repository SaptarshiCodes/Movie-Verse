import { reserveTmdbRequest } from "./api-protection.js";

const DEFAULT_TMDB_BASE_URL = "https://api.themoviedb.org/3";
const INCLUDE_ADULT_RESULTS = "true";
const SAFE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENOTFOUND",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export class TmdbError extends Error {
  constructor(message, status, retryAfter, code) {
    super(message);
    this.name = "TmdbError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new TmdbError("TMDB_API_KEY is not configured.", 503, undefined, "missing_api_key");
  return key;
}

function getBaseUrl() {
  const baseUrl = process.env.TMDB_BASE_URL || DEFAULT_TMDB_BASE_URL;

  try {
    const url = new URL(baseUrl);
    const isLoopbackHttp = url.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !isLoopbackHttp) || url.username || url.password) {
      throw new Error("TMDB_BASE_URL must use HTTPS, or HTTP on loopback, without embedded credentials.");
    }
    return url.toString().replace(/\/+$/, "");
  } catch (error) {
    throw new TmdbError(
      error instanceof Error ? error.message : "TMDB_BASE_URL is invalid.",
      500,
    );
  }
}

function getOperation(path, parameters) {
  if (path === "/search/movie") return "movie_search";
  if (path === "/discover/movie") return "movie_discover";
  if (path === "/movie/popular") return "movie_popular";
  if (/^\/movie\/\d+$/.test(path)) {
    return parameters.append_to_response ? "movie_details_expanded" : "movie_details";
  }
  return "unknown";
}

function getSafeErrorCode(error) {
  const code = error?.cause?.code ?? error?.code;
  return SAFE_ERROR_CODES.has(code) ? code : undefined;
}

function getSafeErrorName(error) {
  const name = error instanceof Error ? error.name : "UnknownError";
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : "UnknownError";
}

function logTmdbRequest({
  operation,
  outcome,
  status,
  appStatus,
  attempts,
  durationMs,
  errorName,
  errorCode,
}) {
  const entry = {
    event: "tmdb.request",
    operation,
    outcome,
    status,
    attempts,
    retryCount: attempts - 1,
    durationMs,
    ...(appStatus === undefined ? {} : { appStatus }),
    ...(errorName ? { errorName } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
  const write = outcome === "error" ? console.error : console.info;
  write(JSON.stringify(entry));
}

async function requestTmdb(path, parameters = {}) {
  const url = new URL(`${getBaseUrl()}${path}`);
  url.searchParams.set("api_key", getApiKey());
  for (const [name, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(name, String(value));
    }
  }

  const operation = getOperation(path, parameters);
  const startedAt = Date.now();
  let lastError;
  let lastErrorCode;
  let lastStatus;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const reservation = await reserveTmdbRequest();
      if (!reservation.allowed) {
        logTmdbRequest({
          operation,
          outcome: "error",
          status: reservation.status,
          appStatus: reservation.status,
          attempts: attempt + 1,
          durationMs: Date.now() - startedAt,
          errorName: reservation.reason,
        });
        throw new TmdbError(
          "Movie data is temporarily busy. Please try again shortly.",
          reservation.status,
          reservation.retryAfter,
          reservation.reason,
        );
      }

      const response = await fetch(url, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(10000),
      });
      lastStatus = response.status;
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(JSON.stringify({
            event: "tmdb.provider_rate_limited",
            operation,
            status: response.status,
          }));
        }
        const status = response.status === 404 || response.status === 429
          ? response.status
          : response.status === 401 || response.status === 403
            ? 503
            : 502;
        if (status !== 502 || attempt === maxAttempts - 1) {
          const providerRetryAfter = response.headers?.get("retry-after");
          const retryAfterSeconds = providerRetryAfter && /^\d+$/.test(providerRetryAfter)
            ? Number(providerRetryAfter)
            : providerRetryAfter
              ? Math.max(1, Math.ceil((Date.parse(providerRetryAfter) - Date.now()) / 1000))
              : undefined;
          logTmdbRequest({
            operation,
            outcome: "error",
            status: lastStatus,
            appStatus: status,
            attempts: attempt + 1,
            durationMs: Date.now() - startedAt,
            errorName: "TmdbError",
          });
          throw new TmdbError(
            "The movie data provider returned an error.",
            status,
            Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
            status === 503 ? "provider_configuration" : undefined,
          );
        }
      } else {
        const data = await response.json();
        logTmdbRequest({
          operation,
          outcome: "success",
          status: response.status,
          attempts: attempt + 1,
          durationMs: Date.now() - startedAt,
          errorName: lastError ? getSafeErrorName(lastError) : undefined,
          errorCode: lastErrorCode,
        });
        return data;
      }
    } catch (error) {
      if (error instanceof TmdbError) throw error;
      lastError = error;
      lastErrorCode = getSafeErrorCode(error);
      if (attempt === maxAttempts - 1) {
        logTmdbRequest({
          operation,
          outcome: "error",
          status: lastStatus,
          appStatus: 502,
          attempts: attempt + 1,
          durationMs: Date.now() - startedAt,
          errorName: getSafeErrorName(error),
          errorCode: lastErrorCode,
        });
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }

  throw new TmdbError("The movie data provider is temporarily unavailable.", 502);
}

export function getMovieCollection({ query = "", page = 1, genre = "" }) {
  const endpoint = query ? "/search/movie" : genre ? "/discover/movie" : "/movie/popular";
  return requestTmdb(endpoint, {
    query: query || undefined,
    with_genres: genre || undefined,
    page,
    include_adult: endpoint === "/movie/popular" ? undefined : INCLUDE_ADULT_RESULTS,
    language: "en-US",
  });
}

export function getMovie(id) {
  return requestTmdb(`/movie/${id}`, { language: "en-US" });
}

export function getMovieDetails(id) {
  return requestTmdb(`/movie/${id}`, {
    append_to_response: "credits,reviews,recommendations,videos",
    language: "en-US",
  }).catch((error) => {
    if (error instanceof TmdbError && [404, 429, 503].includes(error.status)) throw error;

    console.warn(JSON.stringify({
      event: "tmdb.details_fallback",
      operation: "movie_details_expanded",
      fallbackOperation: "movie_details",
      status: error instanceof TmdbError ? error.status : 502,
      errorName: getSafeErrorName(error),
      ...(getSafeErrorCode(error) ? { errorCode: getSafeErrorCode(error) } : {}),
    }));
    return getMovie(id);
  });
}
