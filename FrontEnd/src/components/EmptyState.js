import React from 'react';
import { FiSearch, FiInbox, FiFilter, FiRefreshCw } from 'react-icons/fi';

function EmptyState({
  message = "Nenhum resultado encontrado",
  onAction,
  actionLabel = "Voltar",
  variant = "default",
  icon: CustomIcon,
  className = ""
}) {
  const getEmptyIcon = () => {
    if (CustomIcon) return <CustomIcon className="empty-icon" />;

    if (message?.includes('busca') || message?.includes('encontrado')) {
      return <FiSearch className="empty-icon" />;
    }
    if (message?.includes('filtro') || message?.includes('filtrado')) {
      return <FiFilter className="empty-icon" />;
    }
    return <FiInbox className="empty-icon" />;
  };

  const getEmptyTitle = () => {
    if (message?.includes('busca') || message?.includes('encontrado')) {
      return "Nenhum resultado encontrado";
    }
    if (message?.includes('filtro') || message?.includes('filtrado')) {
      return "Nenhum item corresponde aos filtros";
    }
    return "Lista vazia";
  };

  const getEmptyDescription = () => {
    if (message?.includes('busca') || message?.includes('encontrado')) {
      return "Tente ajustar os termos da busca ou remover alguns filtros.";
    }
    if (message?.includes('filtro') || message?.includes('filtrado')) {
      return "Tente alterar os critérios de filtro para ver mais resultados.";
    }
    return message || "Não há itens para exibir no momento.";
  };

  if (variant === "compact") {
    return (
      <div className={`empty-compact ${className}`}>
        {getEmptyIcon()}
        <span className="empty-compact-text">{message}</span>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className={`empty-minimal ${className}`}>
        {getEmptyIcon()}
        <p className="empty-minimal-text">{message}</p>
      </div>
    );
  }

  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-content">
        {getEmptyIcon()}
        <h3 className="empty-title">{getEmptyTitle()}</h3>
        <p className="empty-description">{getEmptyDescription()}</p>
        {onAction && (
          <button onClick={onAction} className="empty-action-btn">
            <FiRefreshCw className="empty-btn-icon" />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
