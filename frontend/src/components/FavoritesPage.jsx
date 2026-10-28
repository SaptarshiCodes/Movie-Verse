"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import { useFavorites } from "@/components/AppProviders";

export default function FavoritesPage() {
  const { favorites, ready, storageError } = useFavorites();

  return (
    <section className="favorites-page">
      <header className="catalog-heading">
        <div>
          <h1>My list</h1>
          <p>A personal collection of films you want to come back to.</p>
        </div>
        <span className="favorites-count">{favorites.length} saved</span>
      </header>
      {storageError ? <p className="inline-error" role="alert">{storageError}</p> : null}
      {!ready ? (
        <div className="empty-panel" aria-live="polite"><p>Opening your list…</p></div>
      ) : favorites.length ? (
        <div className="movie-grid">
          {favorites.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </div>
      ) : (
        <div className="empty-panel favorites-empty">
          <span className="empty-heart"><Heart size={25} aria-hidden="true" /></span>
          <h2>Your list is waiting for a story.</h2>
          <p>Save a film with the heart button and it will be here next time.</p>
          <Link className="button button-light" href="/">Find a film</Link>
        </div>
      )}
    </section>
  );
}
