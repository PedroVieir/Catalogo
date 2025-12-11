import React from "react";
import { useNavigate } from "react-router-dom";
import ConjuntoGallery from "./ConjuntoGallery";
import "../styles/ProductTable.css";

function ProductTable({ products, onConjuntoSelect, loading = false, initialExpanded = null }) {
  const navigate = useNavigate();

  // ❗ Hooks sempre no topo do componente
  const [expanded, setExpanded] = React.useState(initialExpanded);

  React.useEffect(() => {
    setExpanded(initialExpanded);
  }, [initialExpanded]);

  // Show skeleton rows while loading
  if (loading) {
    const skeletonCount = 8;
    return (
      <section className="product-catalog-container">
        <div className="table-wrapper">
          <table id="product-catalog" className="responsive-table">
            <thead>
              <tr>
                <th>Código ABR</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th className="table-action-cell">Ações</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: skeletonCount }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="skeleton-row">
                  <td data-label="Código ABR">
                    <div className="skeleton skeleton-code" />
                  </td>
                  <td data-label="Descrição">
                    <div className="skeleton skeleton-desc" />
                  </td>
                  <td data-label="Categoria">
                    <div className="skeleton skeleton-cat" />
                  </td>
                  <td className="table-action-cell">
                    <div className="skeleton skeleton-action" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) {
    return <p className="message">Não foram encontrados registros.</p>;
  }

  const handleConjuntoClick = (codigo, e) => {
    e.preventDefault();
    // Toggle expand/collapse for conjunto children
    setExpanded((prev) => (prev === codigo ? null : codigo));

    // Se houver um callback externo para seleção de conjunto, chame-o
    if (onConjuntoSelect) {
      onConjuntoSelect(codigo);
    }
  };

  const handleProductClick = (codigo) => {
    if (!codigo) return;
    navigate(`/produtos/${encodeURIComponent(codigo)}`);
  };

  const handlePieceClick = (codigo) => {
    if (!codigo) return;
    navigate(`/produtos/${encodeURIComponent(codigo)}`);
  };

  return (
    <section className="product-catalog-container">
      <div className="table-wrapper">
        <table id="product-catalog" className="responsive-table">
          <thead>
            <tr>
              <th>Código ABR</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th className="table-action-cell">Ações</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, index) => {
              const hasConjuntos =
                p.conjuntos && Array.isArray(p.conjuntos) && p.conjuntos.length > 0;

              const keyBase = p.codigo || `item-${index}`;

              return (
                <React.Fragment key={keyBase}>
                  <tr className={`product-row ${hasConjuntos ? "row-conjunto" : ""} ${expanded === p.codigo ? "row-expanded" : ""}`}>
                    <td data-label="Código ABR" className="td-code">
                      <div className="code-cell">
                        {hasConjuntos ? (
                          <button
                            className={`expand-btn ${expanded === p.codigo ? 'expanded' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleConjuntoClick(p.codigo, e); }}
                            aria-label={expanded === p.codigo ? 'Fechar conjunto' : 'Abrir conjunto'}
                            title={expanded === p.codigo ? 'Fechar conjunto' : 'Abrir conjunto'}
                          >
                            <span className="chev" />
                          </button>
                        ) : (
                          <span className="expand-placeholder" />
                        )}

                        <div className="thumb-wrapper">
                          <img
                            src={`/vista/${encodeURIComponent(p.codigo)}.jpg`}
                            alt={p.descricao || p.codigo}
                            className="thumb"
                            loading="lazy"
                            onError={(e) => { e.target.style.opacity = 0.45; }}
                          />
                        </div>

                        <div className="code-info">
                          <div className="codigo-text" title={p.codigo}>{p.codigo}</div>
                          <div className="small-desc" title={p.descricao}>{p.descricao}</div>
                        </div>

                        {hasConjuntos && (
                          <span className="conjunto-count-badge" title={`${p.conjuntos.length} peça(s) neste conjunto`}>
                            <svg className="icon-outline badge-svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                              <rect x="3" y="7" width="18" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M3 7l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="badge-number">{p.conjuntos.length}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Descrição" className="td-description">
                      <div className="description-cell">
                        <span className="description-text" title={p.descricao}>{p.descricao}</span>
                      </div>
                    </td>
                    <td data-label="Categoria" className="td-category">
                      <div className="category-badge">
                        <span>{p.grupo || "—"}</span>
                      </div>
                    </td>
                    <td className="table-action-cell" data-label="Ações">
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="table-action-button btn-details"
                          onClick={() => handleProductClick(p.codigo)}
                          aria-label={`Ver detalhes do produto ${p.codigo}`}
                          title="Ver detalhes do produto"
                        >
                          <svg className="icon-outline action-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          <span className="action-label">Detalhes</span>
                        </button>

                        {hasConjuntos && (
                          <button
                            type="button"
                            className="table-action-button btn-conjunto"
                            onClick={(e) => handleConjuntoClick(p.codigo, e)}
                            aria-label={`Ver visualização de conjunto ${p.codigo}`}
                            title={expanded === p.codigo ? "Fechar peças" : "Abrir peças"}
                          >
                            <svg className="icon-outline action-svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                              <path d="M3 7h18v10H3z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M3 7l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                            <span className="action-label">{expanded === p.codigo ? "Fechar" : "Peças"}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {hasConjuntos && expanded === p.codigo && (
                    <tr className="conjunto-children-row">
                      <td colSpan={4}>
                        <div className="conjunto-container">
                          <div className="conjunto-header">
                            <h3>Peças do Conjunto: <strong>{p.codigo}</strong></h3>
                            <span className="piece-count">({p.conjuntos.length} peça{p.conjuntos.length !== 1 ? 's' : ''})</span>
                          </div>
                          <ConjuntoGallery
                            conjuntos={p.conjuntos}
                            onPieceClick={handlePieceClick}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ProductTable;
