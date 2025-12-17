import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ProductList.css";
import DescriptionModal from "./DescriptionModal";

function ProductList({ items = [], loading = false, onConjuntoSelect, isConjuntosView = false }) {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({ title: '', description: '' });

  if (loading) {
    return (
      <div className="pl-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="pl-card skeleton" key={i}>
            <div className="pl-thumb" />
            <div className="pl-body">
              <div className="pl-line short" />
              <div className="pl-line" />
              <div className="pl-line tiny" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return <p className="pl-empty">Nenhum registro encontrado.</p>;
  }

  return (
    <div className="pl-grid" role="list">
      {items.map((p) => {
        const key = p.codigo || p.id || Math.random();
        const hasConj = p.conjuntos && p.conjuntos.length > 0;

        return (
          <article className="pl-card" key={key} role="listitem">
            <header className="pl-card-header">
              <div className="pl-thumb-wrapper" onClick={() => navigate(`/produtos/${encodeURIComponent(p.codigo)}`)}>
                <img
                  src={`/vista/${encodeURIComponent(p.codigo)}.jpg`}
                  alt={p.descricao || p.codigo}
                  className="pl-thumb-img"
                  loading="lazy"
                  onError={(e) => { e.target.style.opacity = 0.45; }}
                />
              </div>

              <div className="pl-meta">
                <div className="pl-code" title={p.codigo}>{p.codigo}</div>
                <div className="pl-desc" title={p.descricao}>{p.descricao}</div>
                <div className="pl-group">{p.grupo || "-"}</div>
                <div className="pl-meta-actions">
                  <button className="pl-small-btn" onClick={() => { setModalData({ title: p.descricao || p.codigo, description: p.descricao || 'Sem descrição' }); setModalOpen(true); }} aria-label={`Ver descrição ${p.codigo}`}>Ver descrição</button>
                </div>
              </div>
            </header>

            <div className="pl-actions">
              {isConjuntosView ? (
                <>
                  <div className="pl-piece-count" aria-hidden>{(p.conjuntos && p.conjuntos.length) || 0} peças</div>
                  <button
                    type="button"
                    className="pl-action btn-primary"
                    onClick={() => navigate(`/produtos/${encodeURIComponent(p.codigo)}`)}
                    aria-label={`Ver detalhes ${p.codigo}`}
                  >
                    <svg className="pl-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span>Detalhes</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pl-action btn-primary"
                    onClick={() => navigate(`/produtos/${encodeURIComponent(p.codigo)}`)}
                    aria-label={`Ver detalhes ${p.codigo}`}
                  >
                    <svg className="pl-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span>Detalhes</span>
                  </button>

                  {hasConj ? (
                    <button
                      type="button"
                      className="pl-action btn-ghost"
                      onClick={() => onConjuntoSelect && onConjuntoSelect(p.codigo)}
                      aria-label={`Ver peças do conjunto ${p.codigo}`}
                    >
                      <svg className="pl-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                        <rect x="3" y="7" width="18" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M3 7l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span>Peças ({p.conjuntos.length})</span>
                    </button>
                  ) : (
                    <div className="pl-spacer" />
                  )}
                </>
              )}
            </div>

            {/* Inline gallery removed for conjuntos list view (pieces count shown on card) */}
          </article>
        );
      })}
        <DescriptionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={modalData.title} description={modalData.description} />
    </div>
  );
}

export default ProductList;
