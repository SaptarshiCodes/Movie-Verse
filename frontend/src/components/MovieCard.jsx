"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ImageOff } from "lucide-react";
import { useState } from "react";
import { useFavorites } from "@/components/AppProviders";
import { imageUrl } from "@/lib/movie-utils";

export default function MovieCard({ movie }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const poster = imageUrl(movie.poster_path, "w500");
  const saved = isFavorite(movie.id);
  const year = movie.release_date?.slice(0, 4);

  return (
    <article className="movie-card">
      <Link className="poster-link" href={`/movie/${movie.id}`} aria-label={`View ${movie.title}`}>
        {poster && !posterFailed ? (
          <>
            {!posterLoaded ? <span aria-hidden="true" className="poster-loading" /> : null}
            <Image
              alt={`${movie.title} poster`}
              className={`movie-poster${posterLoaded ? " movie-poster-loaded" : ""}`}
              height={750}
              loading="lazy"
              onError={() => setPosterFailed(true)}
              onLoad={() => setPosterLoaded(true)}
              sizes="(max-width: 600px) 44vw, (max-width: 1000px) 28vw, 220px"
              src={poster}
              unoptimized
              width={500}
            />
          </>
        ) : (
          <span className="poster-fallback">
            <ImageOff aria-hidden="true" size={22} />
            <span>{movie.title}</span>
            <span className="poster-fallback-note">Poster unavailable</span>
          </span>
        )}
        {movie.vote_average > 0 ? (
          <span className="poster-rating">★ {movie.vote_average.toFixed(1)}</span>
        ) : null}
      </Link>
      <button
        aria-label={saved ? `Remove ${movie.title} from My list` : `Save ${movie.title} to My list`}
        aria-pressed={saved}
        className={`favorite-button${saved ? " favorite-active" : ""}`}
        onClick={() => toggleFavorite(movie)}
        type="button"
      >
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <div className="movie-card-copy">
        <Link href={`/movie/${movie.id}`} className="movie-title">{movie.title}</Link>
        <span className="movie-year">{year || "Release date unavailable"}</span>
      </div>
    </article>
  );
}
