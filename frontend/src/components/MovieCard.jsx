function MovieCard({movie}) {
  return (
    <div className="card bg-base-200/50 max-w-auto shadow-lg">
      <figure className="px-10 pt-10">
        <img
          src={movie.url}
          alt={movie.title}
          className="rounded-xl"
        />
      </figure>
      <div className="card-body items-center text-center">
        <h2 className="card-title">{movie.title}</h2>
        <p>{movie.release_date}</p>
        <div className="card-actions">
          <button className="btn btn-primary">Watch Now</button>
        </div>
      </div>
    </div>
  );
}

export default MovieCard;
