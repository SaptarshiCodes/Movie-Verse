function MovieCardSkeleton() {
  return (
    <div className="card bg-base-200 shadow-lg animate-pulse">
      <div className="h-70 bg-base-300 rounded-t-xl"></div>

      <div className="card-body">
        <div className="h-5 bg-base-300 rounded w-3/4"></div>
        <div className="h-4 bg-base-300 rounded w-1/2"></div>
        <div className="h-4 bg-base-300 rounded w-full"></div>
      </div>
    </div>
  );
}

export default MovieCardSkeleton;