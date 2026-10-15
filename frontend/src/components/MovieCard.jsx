export default function MovieCard({
  movie,
  isOwner,
  onToggleWatched,
  onEdit,
  onDelete,
  isUpdating,
}) {
  return (
    <article className="movie-card">
      <div className="poster-wrap">
        {movie.poster_url && (
          <img
            className="poster-image"
            src={movie.poster_url}
            alt={`${movie.title} poster`}
            loading="lazy"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
        <span className="poster-fallback">{movie.title}</span>
        <span className="rating">★ {movie.rating.toFixed(1)}</span>
      </div>
      <div className="movie-info">
        <div className="movie-title-row">
          <h3>{movie.title}</h3>
          {isOwner && (
            <button
              className={`watched-button ${movie.watched ? 'watched' : ''}`}
              type="button"
              onClick={() => onToggleWatched(movie)}
              disabled={isUpdating}
              aria-label={
                movie.watched
                  ? `Mark ${movie.title} to watch`
                  : `Mark ${movie.title} as watched`
              }
              title={movie.watched ? 'Mark as not watched' : 'Mark as watched'}
            >
              {movie.watched ? '✓' : '○'}
            </button>
          )}
        </div>
        <p>{movie.genre} <span>·</span> {movie.release_year}</p>
        {isOwner ? (
          <div className="movie-actions">
            <button
              className="movie-action-button"
              type="button"
              onClick={() => onEdit(movie)}
              disabled={isUpdating}
            >
              Edit
            </button>
            <button
              className="movie-action-button delete-movie-button"
              type="button"
              onClick={() => onDelete(movie)}
              disabled={isUpdating}
            >
              Delete
            </button>
          </div>
        ) : (
          <p className="text-[9px] font-bold tracking-wide text-muted">
            ORIGINAL COLLECTION · READ ONLY
          </p>
        )}
      </div>
    </article>
  )
}
