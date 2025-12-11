function ErrorMessage({ error, onRetry }) {
  return (
    <div className="error-state">
      <p className="error-message">{error}</p>
      {onRetry && (
        <button onClick={onRetry} className="error-retry-btn">
          Tentar Novamente
        </button>
      )}
    </div>
  );
}

export default ErrorMessage;
