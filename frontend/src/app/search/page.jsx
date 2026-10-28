import MovieCatalog from "@/components/MovieCatalog";

export const metadata = { title: "Search movies" };

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = typeof params.query === "string" ? params.query.trim().slice(0, 100) : "";

  return (
    <MovieCatalog
      mode="search"
      query={query}
      title={query ? `Results for “${query}”` : "Search movies"}
    />
  );
}
