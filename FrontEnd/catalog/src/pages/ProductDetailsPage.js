import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import ConjuntoGallery from "../components/ConjuntoGallery";
import ImageLightbox from "../components/ImageLightbox";
import { useCatalogState } from "../contexts/CatalogContext";
import { fetchProductDetails } from "../services/productService";
import "../styles/CatalogPage.css";

function ProductDetailsPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();
  const { catalogState } = useCatalogState();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      // Validar código
      if (!code || typeof code !== "string" || code.trim().length === 0) {
        throw new Error("Código do produto inválido");
      }

      const result = await fetchProductDetails(code);
      
      // Validar resposta
      if (!result || typeof result !== "object") {
        throw new Error("Resposta do servidor inválida");
      }

      setData(result);
    } catch (err) {
      const errorMsg = err?.message || "Erro desconhecido ao carregar detalhes do produto";
      console.error("Erro ao carregar detalhes:", errorMsg);
      notify.error(errorMsg);
      setError(errorMsg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [code]);

  const product = data?.data?.product || data?.product;
  const conjuntos = Array.isArray(data?.data?.conjuntos) 
    ? data.data.conjuntos 
    : Array.isArray(data?.conjuntos)
    ? data.conjuntos
    : [];

  const handleBackClick = () => {
    try {
      // Tentar voltar no histórico se disponível
      if (window.history && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch (e) {
      console.warn("Erro ao acessar history:", e);
    }

    // Fallback: navegar para home com filtros do estado
    try {
      const params = new URLSearchParams();
      const page = catalogState?.currentPage || 1;
      if (page) params.set("page", String(page));
      
      const f = catalogState?.currentFilters || {};
      if (f?.search) params.set("search", String(f.search));
      if (f?.grupo) params.set("grupo", String(f.grupo));
      if (f?.subgrupo) params.set("subgrupo", String(f.subgrupo));
      if (f?.tipo) params.set("tipo", String(f.tipo));
      if (f?.sortBy) params.set("sortBy", String(f.sortBy));

      navigate(`/?${params.toString()}`);
    } catch (e) {
      console.error("Erro ao navegar:", e);
      navigate("/");
    }
  };

  return (
    <>
      <Header />

      <main className="catalog-main">
        <div className="page-header-row">
          <h1 id="title">Detalhes do Produto</h1>

          <div className="header-actions">
            <button
              className="back-link-btn"
              onClick={handleBackClick}
              title="Voltar"
            >
              <span className="back-link-icon">←</span>
              <span>Voltar</span>
            </button>

            <a href="https://abr-ind.vercel.app/" className="abr-back-link">
              <span className="abr-back-link-icon">←</span>
              <span>Site ABR</span>
            </a>
          </div>
        </div>

        {loading && <LoadingSpinner variant="details" />}

        {error && !loading && (
          <ErrorMessage 
            error={error} 
            onRetry={loadData} 
          />
        )}

        {!loading && !error && product && (
          <div className="product-details">
            <section className="product-info">
              <div className="product-header-section">
                <div className="product-image-container">
                  {!imageError ? (
                    <img
                      src={`/vista/${encodeURIComponent(product.codigo)}.jpg`}
                      alt={`${product.codigo} - ${product.descricao}`}
                      className="product-image"
                      onError={() => setImageError(true)}
                      loading="lazy"
                      onClick={() => setLightboxOpen(true)}
                      style={{ cursor: 'pointer' }}
                      title="Clique para ampliar"
                    />
                  ) : (
                    <div className="product-image-placeholder">
                      <div className="product-image-placeholder-icon">📷</div>
                      <div className="product-image-placeholder-text">Imagem não disponível</div>
                    </div>
                  )}
                </div>

                <div className="product-info-section">
                  <h1>{product.descricao || product.codigo}</h1>

                  <div className="product-info-group">
                    <label>Código</label>
                    <p>{product.codigo}</p>
                  </div>

                  <div className="product-divider"></div>

                  <div className="product-info-group">
                    <label>Grupo</label>
                    <p>{product.grupo || "-"}</p>
                  </div>

                  <div className="product-info-group">
                    <label>Subgrupo</label>
                    <p>{product.subgrupo || "-"}</p>
                  </div>

                  <div className="product-divider"></div>

                  <div className="product-actions">
                    <button
                      className="product-back-btn"
                      onClick={handleBackClick}
                      title="Voltar para o catálogo"
                    >
                      <span>← Voltar</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {conjuntos && conjuntos.length > 0 && (
              <ConjuntoGallery conjuntos={conjuntos} />
            )}
          </div>
        )}

        {!loading && !error && !product && (
          <EmptyState 
            message="Produto não encontrado"
            onAction={() => navigate("/")}
            actionLabel="Voltar ao Catálogo"
          />
        )}
      </main>

      <footer>COPYRIGHT 2014 ABR IND. ALL RIGHTS RESERVED.</footer>

      <ImageLightbox
        isOpen={lightboxOpen}
        imageSrc={product ? `/vista/${encodeURIComponent(product.codigo)}.jpg` : ""}
        alt={product ? `${product.codigo} - ${product.descricao}` : ""}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

export default ProductDetailsPage;
