import { useState, useEffect } from "react";
import MovieCard from "../components/MovieCard";
import MovieCardSkeleton from "../components/MovieCardSkeleton";
import { getPopularMovies, searchMovies } from "../services/api";
import Navbar from "../components/Navbar";

function Home() {
  const [movies, setMovies] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSearch = async (query) => {
    try {
      setLoading(true);
      setMovies([]); // Optional

      if (!query.trim()) {
        const popular = await getPopularMovies();
        setMovies(popular);
        return;
      }

      const results = await searchMovies(query);
      setMovies(results);
    } catch (err) {
      setError("Failed to search movies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadPopularMovies = async () => {
      try {
        const popularMovies = await getPopularMovies();
        setMovies(popularMovies);
      } catch (error) {
        console.error(error);
        setError("Failed to load popular movies...");
      } finally {
        setLoading(false);
      }
    };

    loadPopularMovies();
  }, []);

  if (error) {
    return <div className="text-center text-error text-lg mt-10">{error}</div>;
  }

  return (
    <>
      <Navbar onSearch={handleSearch} />

      <div className="pt-16 sm:pt-18 lg:pt-20 px-2 sm:px-4 md:px-6 lg:px-8">
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-x-2 sm:gap-x-3 lg:gap-x-4 gap-y-3 sm:gap-y-4"
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, index) => (
              <MovieCardSkeleton key={index} />
            ))
          ) : movies.length === 0 ? (
            <div className="col-span-full flex justify-center items-center py-10">
              <h2 className="text-xl font-semibold">No movies found.</h2>
            </div>
          ) : (
            movies.map((movie) => <MovieCard movie={movie} key={movie.id} />)
          )}
        </div>
      </div>
    </>
  );
}

export default Home;
