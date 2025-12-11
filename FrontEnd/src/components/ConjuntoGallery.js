import { useState } from "react";
import "../styles/ConjuntoGallery.css";

function ConjuntoGallery({ conjuntos = [], onPieceClick }) {
  const [imageErrors, setImageErrors] = useState({});

  const handleImageError = (codigo) => {
    setImageErrors((prev) => ({
      ...prev,
      [codigo]: true,
    }));
  };

  if (!conjuntos || conjuntos.length === 0) {
    return null;
  }

  return (
    <section className="conjunto-gallery">
      <div className="conjunto-header">
        <h2>Peças do Conjunto</h2>
        <span className="conjunto-count">{conjuntos.length} peça(s)</span>
      </div>

      <div className="conjunto-grid">
        {conjuntos.map((peca, idx) => {
          const codigo = peca.filho || "";
          const hasError = imageErrors[codigo];

          const qtd = peca.qtd_explosao ? Math.round(Number(peca.qtd_explosao)) : 1;

          return (
            <div
              key={(codigo ? `${codigo}` : `piece-${idx}`)}
              className="conjunto-item"
              role="button"
              tabIndex={0}
              onClick={() => onPieceClick && onPieceClick(codigo)}
              onKeyDown={(e) => { if (e.key === 'Enter') onPieceClick && onPieceClick(codigo); }}
            >
              <div className="conjunto-item-image">
                {!hasError ? (
                  <img
                    src={`/vista/${encodeURIComponent(codigo)}.jpg`}
                    alt={`${codigo} - ${peca.filho_des}`}
                    onError={() => handleImageError(codigo)}
                    loading="lazy"
                  />
                ) : (
                  <div className="conjunto-image-placeholder">
                    <span className="placeholder-icon">📷</span>
                  </div>
                )}
              </div>

              <div className="conjunto-item-info">
                <div className="conjunto-codigo">
                  <strong>{codigo || "N/A"}</strong>
                </div>

                <div className="conjunto-descricao">
                  {peca.filho_des || "Sem descrição"}
                </div>

                {qtd > 1 && (
                  <div className="conjunto-quantidade">
                    <span className="qtd-badge">Qtd: {qtd}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ConjuntoGallery;
