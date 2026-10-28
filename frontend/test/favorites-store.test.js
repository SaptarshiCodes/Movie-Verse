import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createFavoritesStore } from "../src/lib/favorites-store.js";

const originalWindow = globalThis.window;
let storage;
let storageListeners;

function setupWindow(initialValue = null, { readError = null, writeError = null } = {}) {
  const values = new Map();
  if (initialValue !== null) values.set("movie-verse-favorites", initialValue);
  storage = {
    getItem(key) {
      if (readError) throw readError;
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (writeError) throw writeError;
      values.set(key, value);
    },
  };
  storageListeners = new Set();
  globalThis.window = {
    localStorage: storage,
    addEventListener(type, listener) {
      if (type === "storage") storageListeners.add(listener);
    },
    removeEventListener(type, listener) {
      if (type === "storage") storageListeners.delete(listener);
    },
  };
}

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});

test("loads valid favorites and ignores malformed records", (t) => {
  t.mock.method(console, "error", () => {});
  setupWindow(JSON.stringify([
    { id: 1, title: "Valid movie" },
    { id: "2", title: "Invalid ID" },
    { id: 3, title: 4 },
    null,
    { id: 4, title: "x".repeat(301) },
  ]));
  const store = createFavoritesStore();

  assert.deepEqual(store.getSnapshot(), {
    favorites: [{ id: 1, title: "Valid movie" }],
    ready: true,
    storageError: "",
  });
});

test("uses a stable empty server snapshot without accessing browser storage", () => {
  delete globalThis.window;
  const store = createFavoritesStore();

  assert.deepEqual(store.getServerSnapshot(), { favorites: [], ready: false, storageError: "" });
  assert.deepEqual(store.getSnapshot(), { favorites: [], ready: false, storageError: "" });
});

test("adds a reduced favorite record and removes it when toggled again", (t) => {
  t.mock.method(console, "error", () => {});
  setupWindow();
  const store = createFavoritesStore();
  store.getSnapshot();

  store.toggleFavorite({
    id: 10,
    title: "Saved movie",
    poster_path: "/poster.jpg",
    release_date: "2025-01-02",
    vote_average: 7.5,
    overview: "Not persisted",
  });

  assert.deepEqual(store.getSnapshot().favorites, [{
    id: 10,
    title: "Saved movie",
    poster_path: "/poster.jpg",
    release_date: "2025-01-02",
    vote_average: 7.5,
  }]);
  assert.equal(store.isFavorite(10), true);
  assert.deepEqual(JSON.parse(storage.getItem("movie-verse-favorites")), store.getSnapshot().favorites);

  store.toggleFavorite({ id: 10, title: "Saved movie" });
  assert.deepEqual(store.getSnapshot().favorites, []);
  assert.equal(store.isFavorite(10), false);
});

test("removes a favorite by ID and notifies subscribers of matching storage events", (t) => {
  t.mock.method(console, "error", () => {});
  setupWindow(JSON.stringify([{ id: 1, title: "One" }, { id: 2, title: "Two" }]));
  const store = createFavoritesStore();
  store.getSnapshot();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });

  for (const listener of storageListeners) listener({ key: "another-key" });
  assert.equal(notifications, 0);

  for (const listener of storageListeners) listener({ key: "movie-verse-favorites" });
  assert.equal(notifications, 1);
  store.removeFavorite(1);
  assert.deepEqual(store.getSnapshot().favorites, [{ id: 2, title: "Two" }]);
  assert.equal(notifications, 2);

  unsubscribe();
  assert.equal(storageListeners.size, 0);
});

test("reports invalid stored JSON without crashing", (t) => {
  t.mock.method(console, "error", () => {});
  setupWindow("{invalid-json");
  const store = createFavoritesStore();

  assert.equal(store.getSnapshot().ready, true);
  assert.deepEqual(store.getSnapshot().favorites, []);
  assert.match(store.getSnapshot().storageError, /could not open this list/i);
});

test("reports read and write storage errors", (t) => {
  t.mock.method(console, "error", () => {});
  setupWindow(null, { readError: new Error("storage blocked") });
  const readStore = createFavoritesStore();
  assert.match(readStore.getSnapshot().storageError, /could not open this list/i);

  setupWindow(null, { writeError: new Error("quota exceeded") });
  const writeStore = createFavoritesStore();
  writeStore.getSnapshot();
  writeStore.toggleFavorite({ id: 7, title: "Unavailable save" });
  assert.match(writeStore.getSnapshot().storageError, /could not save this list/i);
  assert.equal(writeStore.isFavorite(7), true);
});
