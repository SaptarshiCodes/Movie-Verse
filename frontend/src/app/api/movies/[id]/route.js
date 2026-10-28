import { handleMovieDetailRequest } from "@/lib/movie-route-handlers";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { id } = await params;
  return handleMovieDetailRequest(id, request);
}
