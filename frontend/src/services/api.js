const apiKey = import.meta.env.VITE_API_KEY;
const baseURL = import.meta.env.VITE_BASE_URL;

export const getPopularMovies = async () => {
  const response = await fetch(`${baseURL}/movie/popular?api_key=${apiKey}`);
  const data = await response.json();
  return data.results;
};

export const searchMovies = async (query) => {
  const response = await fetch(
    `${baseURL}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}`,
  );
  const data = await response.json();
  return data.results;
};
