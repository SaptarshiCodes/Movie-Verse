"use client";

import { useState } from "react";
import MovieCatalog from "@/components/MovieCatalog";

const genres = [
  { id: "", name: "All films" },
  { id: "28", name: "Action" },
  { id: "12", name: "Adventure" },
  { id: "16", name: "Animation" },
  { id: "35", name: "Comedy" },
  { id: "80", name: "Crime" },
  { id: "18", name: "Drama" },
  { id: "14", name: "Fantasy" },
  { id: "27", name: "Horror" },
  { id: "10749", name: "Romance" },
  { id: "878", name: "Science fiction" },
  { id: "53", name: "Thriller" },
];

export default function BrowseMovies() {
  const [genre, setGenre] = useState("");
  const selected = genres.find((item) => item.id === genre);

  return (
    <div className="browse-page">
      <header className="catalog-heading browse-heading">
        <div>
          <h1>Choose a feeling.</h1>
          <p>Every genre takes you somewhere different. Pick the mood for tonight.</p>
        </div>
      </header>
      <div className="genre-options" aria-label="Filter by genre" role="group">
        {genres.map((item) => (
          <button
            aria-pressed={genre === item.id}
            className={`genre-option${genre === item.id ? " genre-option-active" : ""}`}
            key={item.id || "all"}
            onClick={() => setGenre(item.id)}
            type="button"
          >
            {item.name}
          </button>
        ))}
      </div>
      <MovieCatalog
        genre={genre}
        key={genre || "all"}
        mode="browse"
        showHeading={false}
        title={`${selected?.name || "All"} movies`}
      />
    </div>
  );
}
