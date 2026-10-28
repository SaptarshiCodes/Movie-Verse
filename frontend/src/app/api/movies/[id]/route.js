import { NextResponse } from "next/server";
import { getMovie } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) {
    return NextResponse.json({ error: "Movie ID must be a positive integer." }, { status: 400 });
  }

  try {
    const movie = await getMovie(movieId);
    return NextResponse.json(movie, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599
      ? error.status
      : 502;
    if (status === 502) console.error("TMDB movie detail request failed:", error);
    const message = status === 503
      ? "Movie data is not configured. Add a server-side TMDB_API_KEY."
      : status === 404
        ? "Movie not found."
        : "Movie data is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}
