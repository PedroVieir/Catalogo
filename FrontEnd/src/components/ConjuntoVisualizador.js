import { useNavigate } from "react-router-dom";
import "../styles/ConjuntoVisualizador.css";

function ConjuntoVisualizador({ conjuntos, parentCode }) {
  const navigate = useNavigate();

  if (!conjuntos || conjuntos.length === 0) {
    return null;
  }

  const handleProductClick = (productCode) => {
    navigate(`/produtos/${encodeURIComponent(productCode)}`);
  };

  return (
    <section className="conjunto-visualizador">
      <h3 className="conjunto-titulo">Peças do Conjunto: {parentCode}</h3>
      
      <div className="conjunto-grid">
        {conjuntos.map((item) => {
          const { filho, filho_des, qtd_explosao, childProduct } = item;
          
          return (
            <div
              key={filho}
              className="conjunto-item"
              onClick={() => handleProductClick(filho)}
              role="button"
              tabIndex="0"
              onKeyPress={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleProductClick(filho);
                }
              }}
            >
              <div className="produto-imagem-container">
                <img
                  src={`/vista/${encodeURIComponent(filho)}.jpg`}
                  alt={filho_des || filho}
                  loading="lazy"
                  className="produto-imagem"
                  onError={(e) => {
                    e.currentTarget.src = "/images/placeholder.jpg";
                  }}
                />
              </div>

              <div className="produto-info">
                <div className="produto-codigo">{filho}</div>
                <div className="produto-descricao">{filho_des || "N/A"}</div>
                {childProduct?.grupo && (
                  <div className="produto-grupo">{childProduct.grupo}</div>
                )}
                {qtd_explosao && qtd_explosao > 1 && (
                  <div className="produto-quantidade">
                    Qtd: {qtd_explosao}
                  </div>
                )}
              </div>

              <div className="produto-overlay">
                <button
                  className="produto-btn-detalhes"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleProductClick(filho);
                  }}
                  aria-label={`Ver detalhes de ${filho}`}
                >
                  <img
                    src="/images/junta.png"
                    width="20"
                    height="20"
                    alt="Detalhe"
                    loading="lazy"
                  />
                  Ver Detalhes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ConjuntoVisualizador;
