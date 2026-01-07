import React from 'react';
import { FiLoader } from 'react-icons/fi';

function LoadingSpinner({ message = "Carregando...", variant = "default", size = "medium" }) {
  const sizeClasses = {
    small: 'loading-spinner-small',
    medium: 'loading-spinner-medium',
    large: 'loading-spinner-large'
  };

  if (variant === "skeleton") {
    return (
      <div className="loading-skeleton">
        <div className="skeleton-header">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-text">
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        </div>
        <div className="skeleton-content">
          <div className="skeleton-line"></div>
          <div className="skeleton-line"></div>
          <div className="skeleton-line short"></div>
        </div>
      </div>
    );
  }

  if (variant === "details") {
    return (
      <div className="loading-details">
        <div className="loading-details-header">
          <div className="loading-details-image"></div>
          <div className="loading-details-info">
            <div className="loading-details-title"></div>
            <div className="loading-details-subtitle"></div>
          </div>
        </div>
        <div className="loading-details-content">
          <div className="loading-details-line"></div>
          <div className="loading-details-line"></div>
          <div className="loading-details-line short"></div>
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="loading-card">
        <div className="loading-card-image"></div>
        <div className="loading-card-content">
          <div className="loading-card-title"></div>
          <div className="loading-card-text"></div>
          <div className="loading-card-text short"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`loading-state ${sizeClasses[size]}`}>
      <div className="loading-spinner-container">
        <FiLoader className="loading-spinner-icon" />
      </div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
}

export default LoadingSpinner;
