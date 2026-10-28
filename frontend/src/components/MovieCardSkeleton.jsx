export default function MovieCardSkeleton() {
  return (
    <div aria-hidden="true" className="movie-card movie-skeleton">
      <div className="skeleton-poster" />
      <div className="skeleton-title" />
      <div className="skeleton-meta" />
    </div>
  );
}
