"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { createFavoritesStore } from "@/lib/favorites-store";

const FavoritesContext = createContext(null);
const favoritesStore = createFavoritesStore();

export default function AppProviders({ children }) {
  const store = useSyncExternalStore(
    favoritesStore.subscribe,
    favoritesStore.getSnapshot,
    favoritesStore.getServerSnapshot,
  );
  const value = useMemo(() => ({
    ...store,
    toggleFavorite: favoritesStore.toggleFavorite,
    isFavorite: favoritesStore.isFavorite,
    removeFavorite: favoritesStore.removeFavorite,
  }), [store]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside AppProviders.");
  return context;
}
