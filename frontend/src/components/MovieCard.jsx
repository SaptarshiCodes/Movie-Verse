function MovieCard({ movie }) {
  return (
    <div className="hover-3d">
    <div
      className="group card w-full max-w-[200px] sm:max-w-[200px] md:max-w-[220px] lg:max-w-[280px]
      h-[360px] sm:h-[380px] md:h-[400px]
      bg-base-200 shadow-lg
      flex flex-col mx-auto cursor-pointer
      transition-all duration-300 ease-out
      hover:-translate-y-2 hover:scale-[1.03]
      hover:shadow-2xl hover:bg-base-300 border border-transparent
      hover:border-primary"
    >
      <figure className="flex-1 px-2 sm:px-3 pt-2 sm:pt-3 pb-1 overflow-hidden">
        <img
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          className="w-full h-full object-cover rounded-xl
             transition-transform duration-300
             group-hover:scale-110"
        />
      </figure>

      <div className="card-body flex-none pt-0 pb-2 px-2 sm:px-3 gap-1 items-center text-center">
        <h2 className="card-title text-base sm:text-lg leading-tight line-clamp-2 mt-1 transition-colors duration-300 group-hover:text-primary">
          {movie.title}
        </h2>

        <p className="text-[11px] sm:text-xs text-gray-500">
          {movie.release_date?.split("-")[0]}
        </p>

        <button
          className="btn btn-primary btn-xs sm:btn-sm mt-1 mb-2
             transition-all duration-300
             group-hover:scale-105"
        >
          Watch Now
        </button>
      </div>
      </div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  );
}

export default MovieCard;
