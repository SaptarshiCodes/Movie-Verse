"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import MovieCard from "@/components/MovieCard";
import MovieCardSkeleton from "@/components/MovieCardSkeleton";
import { imageUrl } from "@/lib/movie-utils";
import { fetchMovieResults } from "@/lib/movie-api";

function startSpotlightTransition(setChanging, timerRef) {
  setChanging(true);
  window.clearTimeout(timerRef.current);
  timerRef.current = window.setTimeout(() => setChanging(false), 180);
}

export default function MovieCatalog({ mode, query = "", genre = "", title, showHeading = true }) {
  const [catalog, setCatalog] = useState({
    key: "",
    movies: [],
    page: 1,
    totalPages: 1,
    loading: true,
    loadingMore: false,
    error: "",
  });
  const [retry, setRetry] = useState(0);
  const [spotlightSelection, setSpotlightSelection] = useState({ key: "", index: 0 });
  const [spotlightPaused, setSpotlightPaused] = useState(false);
  const [spotlightChanging, setSpotlightChanging] = useState(false);
  const [motionPreferenceVersion, setMotionPreferenceVersion] = useState(0);
  const swipeStart = useRef(null);
  const didSwipe = useRef(false);
  const spotlightTransitionTimer = useRef(null);
  const catalogKey = JSON.stringify([mode, query, genre, retry]);
  const currentCatalog = catalog.key === catalogKey;
  const movies = currentCatalog ? catalog.movies : [];
  const page = currentCatalog ? catalog.page : 1;
  const totalPages = currentCatalog ? catalog.totalPages : 1;
  const loading = !currentCatalog || catalog.loading;
  const loadingMore = currentCatalog && catalog.loadingMore;
  const error = currentCatalog ? catalog.error : "";

  useEffect(() => {
    if (mode === "search" && !query) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: "1" });
    if (mode === "search" && query) params.set("query", query);
    if (genre) params.set("genre", genre);

    fetchMovieResults(`/api/movies?${params}`, controller.signal)
      .then((data) => {
        setCatalog({
          key: catalogKey,
          movies: data.results || [],
          page: 1,
          totalPages: data.total_pages || 1,
          loading: false,
          loadingMore: false,
          error: "",
        });
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") {
          setCatalog({
            key: catalogKey,
            movies: [],
            page: 1,
            totalPages: 1,
            loading: false,
            loadingMore: false,
            error: fetchError.message,
          });
        }
      });

    return () => controller.abort();
  }, [mode, query, genre, retry, catalogKey]);

  const spotlightMovies = mode === "popular" ? movies.slice(0, 5) : [];
  const spotlightIndex = spotlightSelection.key === catalogKey ? spotlightSelection.index : 0;
  const spotlight = spotlightMovies[spotlightIndex] || null;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handlePreferenceChange = () => setMotionPreferenceVersion((version) => version + 1);
    preference.addEventListener("change", handlePreferenceChange);
    return () => preference.removeEventListener("change", handlePreferenceChange);
  }, []);

  function moveSpotlight(direction) {
    if (spotlightMovies.length < 2) return;
    startSpotlightTransition(setSpotlightChanging, spotlightTransitionTimer);
    setSpotlightSelection({
      key: catalogKey,
      index: (spotlightIndex + direction + spotlightMovies.length) % spotlightMovies.length,
    });
  }

  useEffect(() => {
    if (spotlightPaused || spotlightMovies.length < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      startSpotlightTransition(setSpotlightChanging, spotlightTransitionTimer);
      setSpotlightSelection((current) => {
        const index = current.key === catalogKey ? current.index : 0;
        return { key: catalogKey, index: (index + 1) % spotlightMovies.length };
      });
    }, 7000);

    return () => window.clearInterval(timer);
  }, [catalogKey, motionPreferenceVersion, spotlightMovies.length, spotlightIndex, spotlightPaused]);

  useEffect(() => () => window.clearTimeout(spotlightTransitionTimer.current), []);

  function handlePointerDown(event) {
    if (
      spotlightMovies.length < 2 ||
      event.button !== 0 ||
      event.target.closest("a, button, input")
    ) {
      return;
    }

    swipeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    didSwipe.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event) {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    swipeStart.current = null;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    didSwipe.current = true;
    moveSpotlight(deltaX < 0 ? 1 : -1);
    window.setTimeout(() => {
      didSwipe.current = false;
    }, 0);
  }

  function handleClickCapture(event) {
    if (!didSwipe.current) return;
    event.preventDefault();
    event.stopPropagation();
    didSwipe.current = false;
  }

  async function loadMore() {
    if (loadingMore || page >= totalPages) return;
    const nextPage = page + 1;
    const params = new URLSearchParams({ page: String(nextPage) });
    const requestKey = catalogKey;
    if (mode === "search" && query) params.set("query", query);
    if (genre) params.set("genre", genre);
    setCatalog((current) => ({ ...current, loadingMore: true, error: "" }));
    try {
      const data = await fetchMovieResults(`/api/movies?${params}`);
      setCatalog((current) => {
        if (current.key !== requestKey) return current;
        const ids = new Set(current.movies.map((movie) => movie.id));
        return {
          ...current,
          movies: [...current.movies, ...data.results.filter((movie) => !ids.has(movie.id))],
          page: nextPage,
          totalPages: data.total_pages || 1,
          loadingMore: false,
        };
      });
    } catch (fetchError) {
      setCatalog((current) => current.key === requestKey
        ? { ...current, loadingMore: false, error: fetchError.message }
        : current);
    } finally {
      setCatalog((current) => current.key === requestKey
        ? { ...current, loadingMore: false }
        : current);
    }
  }

  const backdrop = imageUrl(spotlight?.backdrop_path, "w1280");
  const visibleMovies = spotlight ? movies.slice(spotlightMovies.length) : movies;
  const awaitingSearch = mode === "search" && !query;

  return (
    <div className="catalog-page">
      {mode === "popular" ? (
        <section
          aria-label="Featured movie suggestions. Swipe left or right to explore."
          className={`discovery-hero${backdrop ? " discovery-hero-image" : ""}${spotlightChanging ? " spotlight-changing" : ""}`}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSpotlightPaused(false);
          }}
          onClickCapture={handleClickCapture}
          onFocus={() => setSpotlightPaused(true)}
          onMouseEnter={() => setSpotlightPaused(true)}
          onMouseLeave={() => setSpotlightPaused(false)}
          onPointerCancel={() => { swipeStart.current = null; }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onTouchStart={() => setSpotlightPaused(true)}
          onTouchEnd={() => setSpotlightPaused(false)}
        >
          <div
            aria-hidden="true"
            className="discovery-backdrop"
            style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}
          />
          <div className="hero-copy">
            <p className="hero-context">A universe of stories, waiting</p>
            <h1>Find your next film.</h1>
            <p className="hero-description">
              The movie everyone’s talking about, or the one you haven’t found yet.
              Start somewhere unexpected.
            </p>
            <div className="hero-actions">
              <Link className="button button-light" href="/browse">Explore the collection <ArrowRight size={17} /></Link>
              <Link className="hero-text-link" href="/favorites">Open my list <ArrowDown size={16} /></Link>
            </div>
          </div>
          {spotlight ? (
            <div aria-live="polite" className="spotlight-caption">
              <Link href={`/movie/${spotlight.id}`} className="spotlight-movie">
                <span>In the spotlight</span>
                <strong>{spotlight.title}</strong>
                <span>
                  {spotlight.release_date?.slice(0, 4) || "Movie"}
                  {spotlight.vote_average ? ` · ★ ${spotlight.vote_average.toFixed(1)}` : ""}
                </span>
              </Link>
              {spotlightMovies.length > 1 ? (
                <div aria-label="Movie suggestions" className="spotlight-controls">
                  <span aria-live="off" className="spotlight-count">
                    {spotlightIndex + 1} / {spotlightMovies.length}
                  </span>
                  <button
                    aria-label="Previous movie suggestion"
                    className="spotlight-arrow"
                    onClick={() => moveSpotlight(-1)}
                    type="button"
                  >
                    <ArrowLeft size={17} aria-hidden="true" />
                  </button>
                  <button
                    aria-label="Next movie suggestion"
                    className="spotlight-arrow"
                    onClick={() => moveSpotlight(1)}
                    type="button"
                  >
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="hero-reel" aria-hidden="true"><span>MV</span></div>
          )}
        </section>
      ) : showHeading ? (
        <header className="catalog-heading">
          <div>
            <h1>{title}</h1>
            <p>
              {mode === "search"
                ? query
                  ? "A few possibilities for your next movie night."
                  : "Search by title using the search field above."
                : "Pick a genre and see where the story takes you."}
            </p>
          </div>
          {mode === "search" && query ? <Link className="text-link" href="/browse">Browse genres <ArrowRight size={16} /></Link> : null}
        </header>
      ) : null}

      <section className="movie-section" aria-labelledby="movie-section-title">
        <div className="section-heading">
          <div>
            <h2 id="movie-section-title">
              {mode === "popular" ? "Popular right now" : mode === "search" ? "Your results" : "Movies to explore"}
            </h2>
            <p>{loading ? "Gathering the latest titles…" : `${movies.length} ${movies.length === 1 ? "film" : "films"} in this collection`}</p>
          </div>
          {mode === "popular" ? (
            <Link className="text-link" href="/browse">See all genres <ArrowRight size={16} /></Link>
          ) : null}
        </div>

        {awaitingSearch ? (
          <div className="empty-panel">
            <h2>Start with a title.</h2>
            <p>Use the search field above to find a film by name.</p>
          </div>
        ) : error && !movies.length ? (
          <div className="status-panel" role="alert">
            <h2>Movie listings are unavailable.</h2>
            <p>{error}</p>
            <button className="button button-light" onClick={() => setRetry((count) => count + 1)} type="button">Try again</button>
          </div>
        ) : loading ? (
          <div className="movie-grid" aria-label="Loading movies">
            {Array.from({ length: 10 }, (_, index) => <MovieCardSkeleton key={index} />)}
          </div>
        ) : visibleMovies.length ? (
          <>
            <div className="movie-grid">
              {visibleMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
            </div>
            {error ? <p className="inline-error" role="alert">{error}</p> : null}
            {page < totalPages ? (
              <button className="button button-outline load-more" disabled={loadingMore} onClick={loadMore} type="button">
                {loadingMore ? "Loading…" : "Load more films"}
              </button>
            ) : null}
          </>
        ) : spotlight ? (
          <p className="spotlight-note">
            {spotlightMovies.length > 1
              ? "All available films are featured above. Swipe or use the arrows to discover them."
              : "This is the only film available in this collection right now."}
          </p>
        ) : (
          <div className="empty-panel">
            <h2>{mode === "search" ? "No films found." : "Nothing to show here yet."}</h2>
            <p>Try a different title or explore another part of the collection.</p>
            <Link className="button button-light" href="/browse">Explore genres</Link>
          </div>
        )}
      </section>
    </div>
  );
}
