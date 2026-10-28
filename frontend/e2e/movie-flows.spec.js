import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("searches for a movie and displays deterministic results", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search movies" }).fill("Fixture Feature");
  await page.getByRole("searchbox", { name: "Search movies" }).press("Enter");

  await expect(page).toHaveURL(/\/search\?query=Fixture%20Feature$/);
  await expect(page.getByRole("link", { name: "View Fixture Feature" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your results" })).toBeVisible();
});

test("opens movie details with synopsis, cast, and audience review", async ({ page }) => {
  await page.goto("/movie/9006");

  await expect(page.getByRole("heading", { name: "Fixture Feature", level: 1 })).toBeVisible();
  await expect(page.getByText("A small fixture story used to verify the movie detail experience.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cast" })).toBeVisible();
  await expect(page.getByText("Test Actor")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Audience reviews" })).toBeVisible();
  await expect(page.getByText("A concise review for the browser smoke test.")).toBeVisible();
});

test("sends a fresh CSP nonce for each document render", async ({ page }) => {
  const response = await page.goto("/");
  const firstPolicy = response.headers()["content-security-policy"];
  const firstNonce = firstPolicy.match(/'nonce-([^']+)'/)?.[1];

  expect(firstNonce).toBeTruthy();
  expect(firstPolicy.split(";").find((directive) => directive.trim().startsWith("script-src")))
    .not.toContain("'unsafe-inline'");
  const noncedScripts = await page.evaluate(() => [...document.scripts]
    .map((script) => script.nonce)
    .filter(Boolean));
  expect(noncedScripts).toContain(firstNonce);

  const reloadResponse = await page.reload();
  const secondPolicy = reloadResponse.headers()["content-security-policy"];
  const secondNonce = secondPolicy.match(/'nonce-([^']+)'/)?.[1];
  expect(secondNonce).toBeTruthy();
  expect(secondNonce).not.toBe(firstNonce);
});

test("fetches expanded movie details once across metadata, page render, reload, and API requests", async ({ page, request }) => {
  const fixtureBaseUrl = "http://127.0.0.1:3101/3";
  const movieId = Date.now();
  await request.post(`${fixtureBaseUrl}/__stats/reset`);

  await page.goto(`/movie/${movieId}`);
  await expect(page.getByRole("heading", { name: `Cache Measurement ${movieId}`, level: 1 })).toBeVisible();
  await page.reload();
  const apiResponse = await page.request.get(`/api/movies/${movieId}`);
  expect(apiResponse.ok()).toBe(true);

  const statsResponse = await request.get(`${fixtureBaseUrl}/__stats`);
  const { requests } = await statsResponse.json();
  expect(requests).toEqual({
    [`/movie/${movieId}?append_to_response=credits,reviews,recommendations,videos`]: 1,
  });
});

test("saves a searched movie to My list and keeps it after reload", async ({ page }) => {
  await page.goto("/search?query=Fixture%20Feature");
  const saveButton = page.getByRole("button", { name: "Save Fixture Feature to My list" });
  await expect(saveButton).toBeVisible();
  await saveButton.click();
  await expect(page.getByRole("button", { name: "Remove Fixture Feature from My list" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("link", { name: "My list, 1 saved movies" }).click();
  await expect(page.getByRole("heading", { name: "My list", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fixture Feature", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Fixture Feature", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Fixture Feature from My list" }).click();
  await expect(page.getByRole("heading", { name: "Your list is waiting for a story." })).toBeVisible();
});
