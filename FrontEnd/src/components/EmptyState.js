function EmptyState({ message = "Nenhum resultado encontrado", onAction, actionLabel = "Voltar" }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {onAction && (
        <button onClick={onAction} className="empty-action-btn">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
