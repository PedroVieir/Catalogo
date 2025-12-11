import React from "react";
import "./FeedbackBanner.css";

/**
 * Componente de feedback aprimorado para exibir mensagens importantes
 * Suporta diferentes tipos: success, error, warning, info
 */
function FeedbackBanner({ 
  type = "info", 
  message, 
  title, 
  onClose, 
  icon,
  action,
  actionLabel = "Ação"
}) {
  if (!message) return null;

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case "success":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case "error":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case "warning":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case "info":
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
    }
  };

  return (
    <div className={`feedback-banner feedback-banner--${type}`}>
      <div className="feedback-banner__content">
        <div className="feedback-banner__icon">
          {getIcon()}
        </div>
        <div className="feedback-banner__text">
          {title && <h3 className="feedback-banner__title">{title}</h3>}
          <p className="feedback-banner__message">{message}</p>
        </div>
      </div>
      <div className="feedback-banner__actions">
        {action && (
          <button 
            className="feedback-banner__action-btn"
            onClick={action}
            aria-label={actionLabel}
          >
            {actionLabel}
          </button>
        )}
        {onClose && (
          <button 
            className="feedback-banner__close"
            onClick={onClose}
            aria-label="Fechar mensagem"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default FeedbackBanner;
