import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import ConjuntoGallery from "../components/ConjuntoGallery";
import ImageLightbox from "../components/ImageLightbox";
import { useCatalogState } from "../contexts/CatalogContext";
import { fetchProductDetails } from "../services/productService";
import "../styles/CatalogPage.css";
import "../styles/ProductDetails.css";

function ProductDetailsPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();
  const { catalogState, preloadState, getFromProductsCache } = useCatalogState();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      if (!code || typeof code !== "string" || code.trim().length === 0) {
        throw new Error("Código do produto inválido");
      }

      // First, try to get from products cache
      let usedSnapshot = false;
      const cachedProduct = getFromProductsCache(code);
      if (cachedProduct) {
        setData({ data: { product: cachedProduct, conjuntos: [], aplicacoes: [], benchmarks: [] } });
        usedSnapshot = true;
      }

      // If we have a preloaded snapshot, use it for instant details

      if (preloadState && preloadState.loaded && preloadState.snapshot) {
        const snap = preloadState.snapshot;
        const normalizedCode = String(code || '').toUpperCase().replace(/\s+/g, '').trim();
        const product = (Array.isArray(snap.products) ? snap.products : []).find(p => String(p.codigo || p.code || p.id || '').toUpperCase().replace(/\s+/g, '').trim() === normalizedCode);

        if (product) {
          // Assemble conjuntos / aplicacoes / benchmarks from snapshot
          const conjuntos = (Array.isArray(snap.conjuntos) ? snap.conjuntos.filter(c => (c.pai || c.codigo_conjunto || '').toString().toUpperCase().replace(/\s+/g, '') === normalizedCode) : []).map(c => ({
            filho: c.filho || c.codigo || c.codigo_componente || c.child || '',
            filho_des: c.filho_des || c.descricao || c.des || null,
            qtd_explosao: c.qtd_explosao || c.quantidade || c.qtd || 1
          }));

          const aplicacoes = (Array.isArray(snap.aplicacoes) ? snap.aplicacoes.filter(a => (a.codigo_conjunto || '').toString().toUpperCase().replace(/\s+/g, '') === normalizedCode) : []);
          const benchmarks = (Array.isArray(snap.benchmarks) ? snap.benchmarks.filter(b => (b.codigo || '').toString().toUpperCase().replace(/\s+/g, '') === normalizedCode) : []);

          setData({ data: { product, conjuntos, aplicacoes, benchmarks } });
          usedSnapshot = true;
        }
      }

      // Always try to refresh from server in background if not using snapshot or to update stale info
      try {
        const result = await fetchProductDetails(code);
        if (result && typeof result === 'object') setData(result);
      } catch (err) {
        if (!usedSnapshot) throw err; // If snapshot wasn't available, propagate error
        // else ignore background refresh error
        console.warn('Background refresh of product details failed (ignored):', err.message || err);
      }
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

  // Normalizar estruturas de conjunto vindas do backend para garantir
  // que aceitamos vários formatos (filho, codigo, code, etc.) e
  // exibimos todas as peças que de fato existem.
  const normalizeConjuntoItem = (c) => {
    if (!c || typeof c !== 'object') return null;
    const filho = (c.filho || c.codigo || c.code || c.child || c.filho_codigo || '').toString();
    const filho_des = c.filho_des || c.descricao || c.des || c.nome || '';
    const qtd_explosao = (c.qtd_explosao ?? c.quantidade ?? c.qtd ?? 1);
    return { ...c, filho, filho_des, qtd_explosao };
  };

  const normalizedConjuntos = Array.isArray(conjuntos)
    ? conjuntos.map(normalizeConjuntoItem).filter(Boolean)
    : [];

  const validConjuntos = normalizedConjuntos.filter((c) => String(c.filho).trim() !== '');

  // Log para debugging em dev: mostrar o que o backend retornou e o que será renderizado
  if (process.env.NODE_ENV === 'development') {
    console.group && console.group('ProductDetailsPage: conjuntos');
    console.log('raw conjuntos:', conjuntos);
    console.log('normalizedConjuntos:', normalizedConjuntos);
    console.log(`counts -> raw: ${conjuntos.length}, normalized: ${normalizedConjuntos.length}, valid: ${validConjuntos.length}`);
    console.groupEnd && console.groupEnd('ProductDetailsPage: conjuntos');
  }
  const benchmarks = Array.isArray(data?.data?.benchmarks)
    ? data.data.benchmarks
    : Array.isArray(data?.benchmarks)
      ? data.benchmarks
      : [];

  const aplicacoes = Array.isArray(data?.data?.aplicacoes)
    ? data.data.aplicacoes
    : Array.isArray(data?.aplicacoes)
      ? data.aplicacoes
      : [];

  const formatAplicacao = (a) => {
    if (!a || typeof a !== 'object') return {
      veiculo: 'Veículo não especificado',
      fabricante: 'Fabricante não especificado',
      modelo: null,
      ano: null
    };

    const veiculo = a.veiculo || a.veiculo_nome || a.vehicle || a.veiculo_descricao || 'Veículo não especificado';
    const fabricante = a.fabricante || a.marca || a.manufacturer || a.origem || 'Fabricante não especificado';
    const modelo = a.modelo || a.model || null;
    const ano = a.ano || a.year || null;

    return { veiculo, fabricante, modelo, ano };
  };

  const handleDebug = async () => {
    try {
      const response = await fetch(
        `/api/products/debug/${encodeURIComponent(code)}`
      );
      const data = await response.json();
      console.log('Debug info:', data);
      alert(`Encontrados: ${data.encontrados.length} produto(s)`);
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

  const handleBackClick = () => {
    try {
      if (window.history && window.history.length > 1) {
        navigate(-1);
        return;
      }
    } catch (e) {
      console.warn("Erro ao acessar history:", e);
    }

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

  const handlePieceClick = (codigo) => {
    if (!codigo) return;
    try {
      setLightboxOpen(false);
    } catch (e) {
      // ignore
    }

    try {
      navigate(`/produtos/${encodeURIComponent(String(codigo))}`);
    } catch (e) {
      console.error('Erro ao navegar para produto do conjunto:', e);
    }
  };

  const getImageUrl = () => {
    if (!product?.codigo) return "";
    return `/vista/${encodeURIComponent(product.codigo)}.jpg`;
  };

  const handleCopyCode = () => {
    if (product?.codigo) {
      navigator.clipboard.writeText(product.codigo);
      notify.success("Código copiado para a área de transferência!");
    }
  };

  return (
    <>
      <main className="product-details-main">
        <div className="product-navigation">
          <button className="navigation-back-btn" onClick={handleBackClick}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>Voltar ao Catálogo</span>
          </button>

          <div className="navigation-actions">
            <button
              className="action-btn copy-btn"
              onClick={handleCopyCode}
              title="Copiar código"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copiar Código</span>
            </button>

            <a href="https://abr-ind.vercel.app/" className="abr-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>Site ABR</span>
            </a>
          </div>
        </div>

        {loading && (
          <div className="product-loading-container">
            <LoadingSpinner variant="details" />
            <p className="loading-text">Carregando detalhes do produto...</p>
          </div>
        )}

        {error && !loading && (
          <div className="product-error-container">
            <ErrorMessage
              error={error}
              onRetry={loadData}
            />
          </div>
        )}

        {!loading && !error && product && (
          <div className="product-details-container">
            <div className="product-header">
              <div className="product-header-info">
                <h1 className="product-title">{product.descricao}</h1>
                <div className="product-subtitle">
                  <div className="product-code">
                    <span className="code-label">Código:</span>
                    <span className="code-value" onClick={handleCopyCode} style={{ cursor: 'pointer' }}>
                      {product.codigo}
                    </span>
                  </div>
                  <div className="product-group">
                    <span className="group-label">Grupo:</span>
                    <span className="group-value">{product.grupo || 'Não especificado'}</span>
                  </div>
                </div>
              </div>

              <div className="product-image-preview">
                {!imageError ? (
                  <div
                    className="product-image-wrapper"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <img
                      src={getImageUrl()}
                      alt={`${product.codigo} - ${product.descricao}`}
                      className="product-main-image"
                      onError={() => setImageError(true)}
                      loading="lazy"
                    />
                    <div className="image-overlay">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <span>Clique para ampliar</span>
                    </div>
                  </div>
                ) : (
                  <div className="product-image-placeholder">
                    <div className="placeholder-icon">📷</div>
                    <div className="placeholder-text">Imagem não disponível</div>
                  </div>
                )}
              </div>
            </div>

            <div className="product-tabs">
              <button
                className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Detalhes
              </button>

              {benchmarks.length > 0 && (
                <button
                  className={`tab-btn ${activeTab === 'benchmarks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('benchmarks')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Benchmarks
                </button>
              )}

              {validConjuntos.length > 0 && (
                <button
                  className={`tab-btn ${activeTab === 'conjuntos' ? 'active' : ''}`}
                  onClick={() => setActiveTab('conjuntos')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
                  </svg>
                  Conjuntos
                </button>
              )}

              <button
                className={`tab-btn ${activeTab === 'aplicacoes' ? 'active' : ''}`}
                onClick={() => setActiveTab('aplicacoes')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                Aplicações {aplicacoes.length > 0 && <span className="badge">{aplicacoes.length}</span>}
              </button>
            </div>

            <div className="tab-content">
              {activeTab === 'details' && (
                <div className="details-content">
                  <div className="details-grid">
                    <div className="detail-card">
                      <h3 className="detail-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 16s-3-3.5-3-6 1.5-3 3-3 3 1.5 3 3-3 6-3 6z" />
                          <circle cx="12" cy="8" r="2" />
                        </svg>
                        Informações Básicas
                      </h3>
                      <div className="detail-list">
                        <div className="detail-item">
                          <span className="detail-label">Código:</span>
                          <span className="detail-value">{product.codigo}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Descrição:</span>
                          <span className="detail-value">{product.descricao}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Grupo:</span>
                          <span className="detail-value">{product.grupo || 'Não especificado'}</span>
                        </div>
                        {product.subgrupo && (
                          <div className="detail-item">
                            <span className="detail-label">Subgrupo:</span>
                            <span className="detail-value">{product.subgrupo}</span>
                          </div>
                        )}
                        {product.tipo && (
                          <div className="detail-item">
                            <span className="detail-label">Tipo:</span>
                            <span className="detail-value">{product.tipo}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {benchmarks.length > 0 && (
                      <div className="detail-card benchmarks-preview">
                        <h3 className="detail-title">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          Benchmarks
                          <span className="badge">{benchmarks.length}</span>
                        </h3>
                        <div className="preview-list">
                          {benchmarks.slice(0, 3).map(b => (
                            <div key={b.id} className="preview-item">
                              <span className="preview-origin">{b.origem || '—'}</span>
                              <span className="preview-number">{b.numero_original || '—'}</span>
                            </div>
                          ))}
                          {benchmarks.length > 3 && (
                            <div className="preview-more">
                              +{benchmarks.length - 3} mais...
                            </div>
                          )}
                        </div>
                        <button
                          className="view-all-btn"
                          onClick={() => setActiveTab('benchmarks')}
                        >
                          Ver todos os benchmarks
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'benchmarks' && benchmarks.length > 0 && (
                <div className="benchmarks-content">
                  <div className="section-header">
                    <h2>Benchmarks do Produto</h2>
                    <p>Números originais e similares correspondentes</p>
                  </div>
                  <div className="benchmarks-table">
                    <div className="table-header">
                      <div className="header-cell">Número Original</div>
                      <div className="header-cell">Origem / Fabricante</div>
                      <div className="header-cell">Tipo</div>
                    </div>
                    {benchmarks.map(b => (
                      <div key={b.id} className="table-row">
                        <div className="table-cell original-number">
                          <strong>{b.numero_original || '—'}</strong>
                        </div>
                        <div className="table-cell">
                          {b.origem || '—'}
                        </div>
                        <div className="table-cell">
                          {b.tipo || 'Similar'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'conjuntos' && (
                <div className="conjuntos-content">
                  <div className="section-header">
                    <h2>Peças do Conjunto</h2>
                    <p>Clique em uma peça para ver detalhes</p>
                  </div>

                  {validConjuntos.length === 0 ? (
                    <div className="conjuntos-empty">
                      <EmptyState
                        message="Nenhuma peça vinculada a este produto"
                        onAction={() => { /* no-op */ }}
                        actionLabel="—"
                      />
                    </div>
                  ) : (
                    <ConjuntoGallery
                      conjuntos={validConjuntos}
                      onPieceClick={handlePieceClick}
                    />
                  )}
                </div>
              )}

              {activeTab === 'aplicacoes' && (
                <div className="aplicacoes-content">
                  <div className="section-header">
                    <h2>Aplicações do Produto</h2>
                    <p>Veículos e equipamentos onde este produto é utilizado</p>
                  </div>

                  {aplicacoes.length === 0 ? (
                    <div className="aplicacoes-empty">
                      <EmptyState
                        message="Nenhuma aplicação encontrada para este produto"
                        onAction={() => { /* no-op for now */ }}
                        actionLabel="—"
                      />
                    </div>
                  ) : (
                    <div className="aplicacoes-grid">
                      {aplicacoes.map((a, i) => {
                        const formatted = formatAplicacao(a);
                        const key = a.id || `${formatted.veiculo}-${formatted.fabricante}-${i}`;

                        return (
                          <div key={key} className="aplicacao-card">
                            <div className="aplicacao-header">
                              <h3>{formatted.veiculo}</h3>
                              <span className="aplicacao-type">{a.tipo || '—'}</span>
                            </div>
                            <div className="aplicacao-details">
                              <div className="aplicacao-info">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 7h-9" />
                                  <path d="M14 17H5" />
                                  <circle cx="17" cy="17" r="3" />
                                  <circle cx="7" cy="7" r="3" />
                                </svg>
                                <span>{formatted.fabricante}</span>
                              </div>

                              {formatted.modelo && (
                                <div className="aplicacao-info">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <line x1="3" y1="9" x2="21" y2="9" />
                                    <line x1="9" y1="21" x2="9" y2="9" />
                                  </svg>
                                  <span>Modelo: {formatted.modelo}</span>
                                </div>
                              )}

                              {formatted.ano && (
                                <div className="aplicacao-info">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  <span>Ano: {formatted.ano}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="product-actions-footer">
              <button className="action-btn secondary" onClick={handleBackClick}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Voltar ao Catálogo
              </button>

              <div className="action-group">
                <button className="action-btn" onClick={() => window.print()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Imprimir
                </button>

                <button className="action-btn primary" onClick={handleCopyCode}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copiar Código
                </button>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !product && (
          <div className="product-not-found">
            <EmptyState
              message="Produto não encontrado"
              onAction={() => navigate("/")}
              actionLabel="Voltar ao Catálogo"
            />
          </div>
        )}
      </main>

      {product && (
        <ImageLightbox
          isOpen={lightboxOpen}
          imageSrc={getImageUrl()}
          alt={`${product.codigo} - ${product.descricao}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

export default ProductDetailsPage;