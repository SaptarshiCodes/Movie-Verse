import assert from "node:assert/strict";
import test from "node:test";
import { imageUrl, safeExternalUrl } from "../src/lib/movie-utils.js";

test("builds image URLs only for valid TMDB image paths", () => {
  assert.equal(imageUrl("/abc_123.jpg"), "https://image.tmdb.org/t/p/w500/abc_123.jpg");
  assert.equal(imageUrl("/abc.jpg", "w185"), "https://image.tmdb.org/t/p/w185/abc.jpg");
  assert.equal(imageUrl(null), null);
  assert.equal(imageUrl("https://attacker.example/poster.jpg"), null);
  assert.equal(imageUrl("/../secret.jpg"), null);
  assert.equal(imageUrl("/poster path.jpg"), null);
});

test("allows only valid HTTP and HTTPS external URLs", () => {
  assert.equal(safeExternalUrl("https://www.themoviedb.org/movie/42"), "https://www.themoviedb.org/movie/42");
  assert.equal(safeExternalUrl("http://example.com/film"), "http://example.com/film");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("//example.com/film"), null);
  assert.equal(safeExternalUrl("not a URL"), null);
  assert.equal(safeExternalUrl(null), null);
});
