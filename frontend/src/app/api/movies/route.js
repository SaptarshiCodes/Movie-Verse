import { handleMovieCollectionRequest } from "@/lib/movie-route-handlers";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return handleMovieCollectionRequest(request);
}
