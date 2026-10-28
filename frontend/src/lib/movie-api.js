const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function waitBeforeRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("The request was aborted.", "AbortError"));
      return;
    }

    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal.reason ?? new DOMException("The request was aborted.", "AbortError"));
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}

export async function fetchMovieResults(url, signal) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal });
      let data;

      try {
        data = await response.json();
      } catch (error) {
        if (response.ok) throw error;
        const requestError = new Error("Could not load movies.");
        requestError.status = response.status;
        throw requestError;
      }

      if (!response.ok) {
        const requestError = new Error(data.error || "Could not load movies.");
        requestError.status = response.status;
        throw requestError;
      }

      return data;
    } catch (error) {
      if (signal?.aborted || error.name === "AbortError") throw error;

      const canRetry = !Number.isInteger(error.status) || RETRYABLE_STATUSES.has(error.status);
      if (!canRetry || attempt === MAX_ATTEMPTS - 1) throw error;
    }

    await waitBeforeRetry(400 * (attempt + 1), signal);
  }

  throw new Error("Could not load movies.");
}
