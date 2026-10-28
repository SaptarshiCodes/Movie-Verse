export function imageUrl(path, size = "w500") {
  if (typeof path !== "string" || !/^\/[A-Za-z0-9._/-]+$/.test(path) || path.includes("..")) {
    return null;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function safeExternalUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
