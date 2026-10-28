import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MovieCard from "@/components/MovieCard";
import { getMovieDetails } from "@/lib/tmdb";
import { imageUrl, safeExternalUrl } from "@/lib/movie-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const movieId = Number(id);
  if (!Number.isSafeInteger(movieId) || movieId < 1) return { title: "Movie not found" };

  try {
    const movie = await getMovieDetails(movieId);
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
    movie = await getMovieDetails(movieId);
  } catch (error) {
    if (error.status === 404) notFound();
    throw error;
  }

  const poster = imageUrl(movie.poster_path, "w780");
  const backdrop = imageUrl(movie.backdrop_path, "w1280");
  const homepage = safeExternalUrl(movie.homepage);
  const allCast = movie.credits?.cast ?? [];
  const cast = allCast.slice(0, 12);
  const directors = movie.credits?.crew?.filter((person) => person.job === "Director").slice(0, 2) ?? [];
  const writers = movie.credits?.crew
    ?.filter((person) => ["Writer", "Screenplay", "Story", "Teleplay"].includes(person.job))
    .slice(0, 3) ?? [];
  const crewForRole = (job) => [...new Set(
    (movie.credits?.crew ?? []).filter((person) => person.job === job).map((person) => person.name),
  )].slice(0, 3);
  const reviews = movie.reviews?.results?.slice(0, 5) ?? [];
  const allRecommendations = movie.recommendations?.results ?? [];
  const recommendations = allRecommendations.slice(0, 8);
  const trailer = movie.videos?.results?.find(
    (video) => video.site === "YouTube"
      && video.type === "Trailer"
      && typeof video.key === "string"
      && /^[A-Za-z0-9_-]+$/.test(video.key),
  );
  const trailerUrl = trailer ? safeExternalUrl(`https://www.youtube.com/watch?v=${trailer.key}`) : null;
  const productionCountries = movie.production_countries?.map((country) => country.name).join(", ");
  const productionCompanies = movie.production_companies?.slice(0, 4) ?? [];
  const spokenLanguages = movie.spoken_languages?.map((language) => language.english_name || language.name).join(", ");
  const imdbUrl = typeof movie.imdb_id === "string" && /^tt\d{7,10}$/.test(movie.imdb_id)
    ? safeExternalUrl(`https://www.imdb.com/title/${movie.imdb_id}/`)
    : null;
  const formatCurrency = (amount) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);

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
          <div className="detail-actions">
            {homepage ? (
              <a className="button button-light" href={homepage} target="_blank" rel="noopener noreferrer">
                Visit official site
              </a>
            ) : null}
            {trailerUrl ? (
              <a className="button button-outline" href={trailerUrl} target="_blank" rel="noopener noreferrer">
                Watch trailer
              </a>
            ) : null}
            {imdbUrl ? (
              <a className="button button-outline" href={imdbUrl} target="_blank" rel="noopener noreferrer">
                View on IMDb
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <section className="detail-section" aria-labelledby="movie-facts-heading">
        <h2 id="movie-facts-heading">The details</h2>
        <dl className="movie-facts">
          {movie.original_title && movie.original_title !== movie.title ? (
            <div><dt>Original title</dt><dd>{movie.original_title}</dd></div>
          ) : null}
          {movie.original_language ? (
            <div><dt>Original language</dt><dd>{movie.original_language.toUpperCase()}</dd></div>
          ) : null}
          {spokenLanguages ? <div><dt>Languages</dt><dd>{spokenLanguages}</dd></div> : null}
          {movie.release_date ? (
            <div>
              <dt>Release date</dt>
              <dd>{new Date(`${movie.release_date}T00:00:00Z`).toLocaleDateString("en-US", {
                dateStyle: "long",
                timeZone: "UTC",
              })}</dd>
            </div>
          ) : null}
          {movie.status ? <div><dt>Status</dt><dd>{movie.status}</dd></div> : null}
          {productionCountries ? <div><dt>Country</dt><dd>{productionCountries}</dd></div> : null}
          {movie.belongs_to_collection?.name ? (
            <div><dt>Collection</dt><dd>{movie.belongs_to_collection.name}</dd></div>
          ) : null}
          {productionCompanies.length ? (
            <div>
              <dt>Production</dt>
              <dd>{productionCompanies.map((company) => company.name).join(", ")}</dd>
            </div>
          ) : null}
          {directors.length ? (
            <div><dt>Directed by</dt><dd>{directors.map((person) => person.name).join(", ")}</dd></div>
          ) : null}
          {writers.length ? (
            <div><dt>Written by</dt><dd>{writers.map((person) => person.name).join(", ")}</dd></div>
          ) : null}
          {crewForRole("Producer").length ? (
            <div><dt>Produced by</dt><dd>{crewForRole("Producer").join(", ")}</dd></div>
          ) : null}
          {crewForRole("Director of Photography").length ? (
            <div><dt>Cinematography</dt><dd>{crewForRole("Director of Photography").join(", ")}</dd></div>
          ) : null}
          {crewForRole("Original Music Composer").length ? (
            <div><dt>Music</dt><dd>{crewForRole("Original Music Composer").join(", ")}</dd></div>
          ) : null}
          {crewForRole("Editor").length ? (
            <div><dt>Edited by</dt><dd>{crewForRole("Editor").join(", ")}</dd></div>
          ) : null}
          {typeof movie.budget === "number" && movie.budget > 0 ? (
            <div><dt>Budget</dt><dd>{formatCurrency(movie.budget)}</dd></div>
          ) : null}
          {typeof movie.revenue === "number" && movie.revenue > 0 ? (
            <div><dt>Box office</dt><dd>{formatCurrency(movie.revenue)}</dd></div>
          ) : null}
          {typeof movie.vote_count === "number" && movie.vote_count > 0 ? (
            <div><dt>Rating votes</dt><dd>{movie.vote_count.toLocaleString("en-US")}</dd></div>
          ) : null}
        </dl>
      </section>
      <section className="detail-section" aria-labelledby="cast-heading">
        <h2 id="cast-heading">Cast</h2>
        {allCast.length > cast.length ? (
          <p className="detail-section-note">
            Showing {cast.length} of {allCast.length.toLocaleString("en-US")} cast members listed on TMDB.
          </p>
        ) : null}
        {cast.length ? (
          <ul className="cast-list">
            {cast.map((person) => {
              const profile = imageUrl(person.profile_path, "w185");
              return (
                <li className="cast-member" key={person.cast_id ?? person.credit_id}>
                  {profile ? (
                    <div className="cast-photo">
                      <Image
                        alt=""
                        className="cast-photo-image"
                        fill
                        sizes="(max-width: 700px) 25vw, 112px"
                        src={profile}
                        unoptimized
                      />
                    </div>
                  ) : <div className="cast-photo cast-photo-empty" aria-hidden="true" />}
                  <strong>{person.name}</strong>
                  {person.character ? <span>{person.character}</span> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="detail-empty">Cast information is not available yet.</p>}
      </section>
      <section className="detail-section" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">Audience reviews</h2>
        {(movie.reviews?.results?.length ?? 0) > reviews.length ? (
          <p className="detail-section-note">
            Showing {reviews.length} of {movie.reviews.results.length.toLocaleString("en-US")} reviews on TMDB.
          </p>
        ) : null}
        {reviews.length ? (
          <div className="audience-reviews">
            {reviews.map((review) => {
              const reviewUrl = safeExternalUrl(review.url);
              const rating = review.author_details?.rating;
              return (
                <article className="audience-review" key={review.id}>
                  <div className="review-heading">
                    <h3>{review.author || "TMDB user"}</h3>
                    {typeof rating === "number" ? (
                      <span className="review-rating">★ {rating.toFixed(1)} / 10</span>
                    ) : null}
                  </div>
                  {review.created_at ? (
                    <p className="review-date">
                      {new Date(review.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}
                    </p>
                  ) : null}
                  <p className="review-content">{review.content}</p>
                  {reviewUrl ? (
                    <a className="text-link" href={reviewUrl} target="_blank" rel="noopener noreferrer">
                      Read on TMDB
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : <p className="detail-empty">No audience reviews have been published for this film yet.</p>}
      </section>
      <section className="detail-section" aria-labelledby="recommendations-heading">
        <h2 id="recommendations-heading">You may also like</h2>
        {allRecommendations.length > recommendations.length ? (
          <p className="detail-section-note">
            Showing {recommendations.length} of {allRecommendations.length.toLocaleString("en-US")} recommendations from TMDB.
          </p>
        ) : null}
        {recommendations.length ? (
          <div className="movie-grid">
            {recommendations.map((recommendation) => (
              <MovieCard key={recommendation.id} movie={recommendation} />
            ))}
          </div>
        ) : <p className="detail-empty">There are no similar films to show right now.</p>}
      </section>
      <p className="tmdb-credit">
        Movie data, credits, and audience reviews provided by The Movie Database (TMDB).
      </p>
    </article>
  );
}
