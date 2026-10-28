import { getMovieCollection, getMovieDetails } from "./tmdb.js";
import { checkMovieApiRateLimit, rateLimitResponse } from "./api-protection.js";

const PRIVATE_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

function errorResponse(message, status, retryAfter) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (status === 429 && Number.isSafeInteger(retryAfter) && retryAfter > 0) {
    headers.set("Retry-After", String(retryAfter));
  }
  return Response.json({ error: message }, { status, headers });
}

function mapProviderError(error, { movieId } = {}) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
    ? error.status
    : 502;

  const message = status === 503
    && ["missing_api_key", "provider_configuration"].includes(error?.code)
    ? "Movie data is not configured. Add a server-side TMDB_API_KEY."
    : status === 429
      ? "Movie data is temporarily busy. Please try again shortly."
      : status === 404 && movieId !== undefined
        ? "Movie not found."
        : "Movie data is temporarily unavailable.";

  return errorResponse(
    message,
    status,
    error?.retryAfter,
  );
}

export async function handleMovieCollectionRequest(request) {
  const rateLimit = await checkMovieApiRateLimit(request);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  const searchParams = new URL(request.url).searchParams;
  const query = (searchParams.get("query") || "").trim();
  const page = Number(searchParams.get("page") || "1");
  const genre = searchParams.get("genre");

  if (query.length > 100) {
    return errorResponse("Search must be 100 characters or fewer.", 400);
  }
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return errorResponse("Page must be between 1 and 500.", 400);
  }
  if (genre !== null && (!/^\d{1,5}$/.test(genre) || Number(genre) < 1)) {
    return errorResponse("Genre must be a positive numeric ID.", 400);
  }

  try {
    const results = await getMovieCollection({ query, page, genre });
    return Response.json(results, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return mapProviderError(error);
  }
}

export async function handleMovieDetailRequest(id, request = new Request("http://localhost/api/movies")) {
  const rateLimit = await checkMovieApiRateLimit(request);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) {
    return errorResponse("Movie ID must be a positive integer.", 400);
  }

  try {
    const movie = await getMovieDetails(movieId);
    return Response.json(movie, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return mapProviderError(error, { movieId });
  }
}
