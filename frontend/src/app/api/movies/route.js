import { NextResponse } from "next/server";
import { getMovieCollection } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") || "").trim();
  const page = Number(searchParams.get("page") || "1");
  const genre = searchParams.get("genre");

  if (query.length > 100) {
    return NextResponse.json({ error: "Search must be 100 characters or fewer." }, { status: 400 });
  }
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    return NextResponse.json({ error: "Page must be between 1 and 500." }, { status: 400 });
  }
  if (genre !== null && (!/^\d{1,5}$/.test(genre) || Number(genre) < 1)) {
    return NextResponse.json({ error: "Genre must be a positive numeric ID." }, { status: 400 });
  }

  try {
    const results = await getMovieCollection({ query, page, genre });
    return NextResponse.json(results, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 502;
    if (status === 502) console.error("TMDB movie request failed:", error);
    const message = status === 503
      ? "Movie data is not configured. Add a server-side TMDB_API_KEY."
      : status === 429
        ? "Movie data is temporarily busy. Please try again shortly."
        : "Movie data is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
