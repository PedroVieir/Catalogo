function LoadingSpinner({ message = "Carregando...", variant = "simple" }) {
  if (variant === "details") {
    return (
      <div className="details-skeleton">
        <div className="details-skeleton-left skeleton-img" />
        <div className="details-skeleton-right">
          <div className="skeleton-line title" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />

          <div className="skeleton-block">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>

          <div className="skeleton-actions">
            <div className="skeleton-btn" />
            <div className="skeleton-btn small" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-state">
      <div className="loading-spinner" aria-hidden></div>
      <p>{message}</p>
    </div>
  );
}

export default LoadingSpinner;
