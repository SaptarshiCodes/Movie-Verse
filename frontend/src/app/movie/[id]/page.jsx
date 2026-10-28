import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovie } from "@/lib/tmdb";
import { imageUrl, safeExternalUrl } from "@/lib/movie-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) return { title: "Movie not found" };

  try {
    const movie = await getMovie(movieId);
    return {
      title: movie.title,
      description: movie.overview || `Details and information for ${movie.title}.`,
    };
  } catch (error) {
    if (error.status === 404) return { title: "Movie not found" };
    return { title: "Movie details" };
  }
}

export default async function MoviePage({ params }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) notFound();

  let movie;
  try {
    movie = await getMovie(movieId);
  } catch (error) {
    if (error.status === 404) notFound();
    throw error;
  }

  const poster = imageUrl(movie.poster_path, "w780");
  const backdrop = imageUrl(movie.backdrop_path, "w1280");
  const homepage = safeExternalUrl(movie.homepage);

  return (
    <article className="movie-detail">
      {backdrop ? (
        <div
          className="detail-backdrop"
          style={{ backgroundImage: `linear-gradient(90deg, #000 4%, rgba(0,0,0,.62) 66%, rgba(0,0,0,.2)), url("${backdrop}")` }}
          role="img"
          aria-label={`${movie.title} backdrop`}
        />
      ) : null}
      <Link className="back-link" href="/">
        ← Back to discovery
      </Link>
      <div className="detail-layout">
        <div className="detail-poster">
          {poster ? (
            <Image
              src={poster}
              alt={`${movie.title} poster`}
              width={520}
              height={780}
              priority
              unoptimized
            />
          ) : (
            <div className="poster-fallback">{movie.title}</div>
          )}
        </div>
        <div className="detail-copy">
          <h1>{movie.title}</h1>
          {movie.tagline ? <p className="movie-tagline">{movie.tagline}</p> : null}
          <div className="detail-facts">
            {movie.release_date ? <span>{movie.release_date.slice(0, 4)}</span> : null}
            {movie.runtime ? <span>{movie.runtime} min</span> : null}
            {movie.vote_average ? (
              <span className="rating">★ {movie.vote_average.toFixed(1)} / 10</span>
            ) : null}
          </div>
          {movie.genres?.length ? (
            <ul className="genre-list">
              {movie.genres.map((genre) => <li key={genre.id}>{genre.name}</li>)}
            </ul>
          ) : null}
          <h2>About this film</h2>
          <p className="detail-overview">
            {movie.overview || "A synopsis has not been added for this film yet."}
          </p>
          {homepage ? (
            <a className="button button-light" href={homepage} target="_blank" rel="noopener noreferrer">
              Visit official site
            </a>
          ) : null}
        </div>
      </div>
      <p className="tmdb-credit">
        Movie data and imagery provided by The Movie Database (TMDB).
      </p>
    </article>
  );
}
