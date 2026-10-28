"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";

const FavoritesContext = createContext(null);
const STORAGE_KEY = "movie-verse-favorites";
const SERVER_STATE = { favorites: [], ready: false, storageError: "" };
let state = SERVER_STATE;
let initialized = false;
const listeners = new Set();

function parseFavorites() {
  const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  if (!Array.isArray(value)) return [];
  return value.filter(
    (movie) =>
      movie &&
      Number.isSafeInteger(movie.id) &&
      typeof movie.title === "string" &&
      movie.title.length <= 300,
  );
}

function publish(nextState) {
  state = nextState;
  for (const listener of listeners) listener();
}

function initializeStore() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    state = { favorites: parseFavorites(), ready: true, storageError: "" };
  } catch (error) {
    console.error("Could not read the personal movie list:", error);
    state = {
      favorites: [],
      ready: true,
      storageError: "Your browser could not open this list. Check its storage settings.",
    };
  }
}

function getSnapshot() {
  initializeStore();
  return state;
}

function subscribe(listener) {
  listeners.add(listener);
  const syncFromStorage = (event) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    try {
      publish({ favorites: parseFavorites(), ready: true, storageError: "" });
    } catch (error) {
      console.error("Could not read the personal movie list:", error);
      publish({
        ...state,
        ready: true,
        storageError: "Your browser could not open this list. Check its storage settings.",
      });
    }
  };
  window.addEventListener("storage", syncFromStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", syncFromStorage);
  };
}

function saveFavorites(favorites) {
  let storageError = "";
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error("Could not save the personal movie list:", error);
    storageError = "Your browser could not save this list. Check its storage settings.";
  }
  publish({ favorites, ready: true, storageError });
}

function toggleFavorite(movie) {
  const nextFavorites = state.favorites.some((item) => item.id === movie.id)
    ? state.favorites.filter((item) => item.id !== movie.id)
    : [...state.favorites, {
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path || null,
        release_date: movie.release_date || "",
        vote_average: movie.vote_average || 0,
      }];
  saveFavorites(nextFavorites);
}

function removeFavorite(id) {
  saveFavorites(state.favorites.filter((movie) => movie.id !== id));
}

export default function AppProviders({ children }) {
  const store = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
  const value = useMemo(() => ({
    ...store,
    toggleFavorite,
    isFavorite: (id) => store.favorites.some((movie) => movie.id === id),
    removeFavorite,
  }), [store]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside AppProviders.");
  return context;
}
