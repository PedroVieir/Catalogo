import React from 'react';
import '../styles/DescriptionModal.css';

function DescriptionModal({ isOpen, onClose, title, description }) {
  if (!isOpen) return null;

  return (
    <div className="dm-overlay" role="dialog" aria-modal="true" aria-labelledby="dm-title">
      <div className="dm-panel">
        <header className="dm-header">
          <h3 id="dm-title">{title || 'Descrição'}</h3>
          <button className="dm-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="dm-body">
          <p>{description || 'Sem descrição disponível.'}</p>
        </div>

        <footer className="dm-footer">
          <button className="dm-btn" onClick={onClose}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}

export default DescriptionModal;