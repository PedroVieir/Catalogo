import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FilterModal from "../components/FilterModal";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import {
  fetchProductsPaginated,
  fetchConjuntosPaginated,
  fetchFilters,
  seedFabricantes
} from "../services/productService";
import { useCatalogState } from "../contexts/CatalogContext";

// Filtros hardcoded conforme solicitado
const HARDCODED_FABRICANTES = [
  "AGRALE",
  "ASIA",
  "CASE",
  "CBT",
  "CITROEN",
  "CUMMINS",
  "DODGE",
  "ENGESA",
  "FIAT",
  "FIAT ALLIS",
  "FIAT/IVECO",
  "FORD",
  "FOTON",
  "GM CHEVROLET",
  "HONDA",
  "HYUNDAI",
  "IVECO",
  "JCB",
  "JEEP",
  "JOHN DEERE",
  "KIA",
  "KOMATSU",
  "LAND ROVER",
  "MAN",
  "MASSEY FERGUSON",
  "MERCEDES BENZ",
  "MITSUBISHI",
  "MWM",
  "NEW HOLLAND",
  "NISSAN",
  "PERKINS / MAXION / INTERNATIONAL",
  "PEUGEOT",
  "RENAULT",
  "SCANIA",
  "SUZUKI",
  "TOYOTA",
  "TROLLER",
  "VALTRA / VALMET",
  "VOLARE",
  "VOLKSWAGEN",
  "VOLVO"
];

const HARDCODED_GRUPOS = [
  "JOGOS DE JUNTAS",
  "JUNTA DO CARTER",
  "JUNTA DO COLETOR DE ADMISSÃO",
  "JUNTA DO COLETOR DE ADMISSÃO E ESCAPAMENTO",
  "JUNTA DO COLETOR DE ESCAPAMENTO",
  "JUNTAS DE CABEÇOTE",
  "JUNTAS DIVERSAS",
  "RETENTORES",
  "TAMPA DE VÁLVULA",
  "TAMPA FRONTAL"
];

function CatalogPage() {
  const { catalogState, updateCatalogState, preloadState, addToProductsCache, filtersLoading } = useCatalogState();
  // notification helper (unused currently)
  // const notify = useNotification();
  const PAGE_LIMIT = 50;
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [availableFilters, setAvailableFilters] = useState({
    grupos: HARDCODED_GRUPOS,
    subgrupos: [], // Removido conforme solicitado
    fabricantes: HARDCODED_FABRICANTES,
    vehicleTypes: []
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [imageErrors, setImageErrors] = useState({});
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  const activeFiltersCount = Object.values(catalogState.currentFilters || {})
    .filter(v => v && v !== "").length;
  // Load products with error handling for data structure
  async function loadProducts(page = 1) {
    try {
      setLoading(true);
      setError("");

      // If preload is in progress, wait briefly (up to 3s) for it to finish so we can use snapshot
      if (preloadState && preloadState.loading && !preloadState.loaded) {
        const startWait = Date.now();
        while (preloadState.loading && !preloadState.loaded && Date.now() - startWait < 3000) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const validPage = Math.max(1, Math.floor(page) || 1);
      const filters = {
        search: catalogState?.currentFilters?.search || "",
        grupo: catalogState?.currentFilters?.grupo || "",
        fabricante: catalogState?.currentFilters?.fabricante || "",
        tipoVeiculo: catalogState?.currentFilters?.tipoVeiculo || ""
      };

      let items = [];
      let paginationResp = {
        page: validPage,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 0
      };

      try {
        // If we have a preloaded snapshot on context and it's fresh, use it to build the initial list
        if (preloadState && preloadState.loaded && preloadState.snapshot) {
          const snap = preloadState.snapshot;
          let itemsFromSnap = Array.isArray(snap.products) ? snap.products.slice() : [];

          // Apply the same filters as the server (search, grupo, numero_original, fabricante/tipoVeiculo)
          if (filters.search) {
            const sf = filters.search.toLowerCase();
            itemsFromSnap = itemsFromSnap.filter(p => (p.codigo || '').toLowerCase().includes(sf) || (p.descricao || '').toLowerCase().includes(sf));
          }
          if (filters.grupo) {
            itemsFromSnap = itemsFromSnap.filter(p => p.grupo === filters.grupo);
          }

          // For fabricante / tipoVeiculo we need to consult aplicacoes to find matching conjuntos
          if (filters.fabricante || filters.tipoVeiculo) {
            const aplic = Array.isArray(snap.aplicacoes) ? snap.aplicacoes : [];
            const fabricanteFilter = filters.fabricante ? (txt => (txt || '').toLowerCase().includes(filters.fabricante.toLowerCase())) : () => true;

            const matchingConjuntos = new Set();
            aplic.forEach(a => {
              const fabricaMatch = fabricanteFilter(a.fabricante || '');
              const tipoMatch = !filters.tipoVeiculo || (a.tipo || a.tipoVeiculo || '').toString().toUpperCase() === (filters.tipoVeiculo || '').toString().toUpperCase();
              if (fabricaMatch && tipoMatch) matchingConjuntos.add((a.codigo_conjunto || '').toString().replace(/\s+/g, '').toUpperCase());
            });

            itemsFromSnap = itemsFromSnap.filter(p => matchingConjuntos.has((p.codigo || '').toString().replace(/\s+/g, '').toUpperCase()));
          }

          // Transform items to the UI shape (as before)
          itemsFromSnap = itemsFromSnap.map(it => ({
            codigo: String(it.codigo || it.code || it.id || '').trim(),
            descricao: String(it.descricao || it.desc || it.nome || '').trim(),
            grupo: it.grupo || '',
            tipo: 'produto',
            ...it
          })).filter(it => it.codigo && it.descricao);

          // Sorting
          const sortBy = catalogState?.currentFilters?.sortBy || 'codigo';
          if (sortBy === 'descricao') {
            itemsFromSnap.sort((a, b) => String(a.descricao || '').localeCompare(String(b.descricao || '')));
          } else if (sortBy === 'grupo') {
            itemsFromSnap.sort((a, b) => String(a.grupo || '').localeCompare(String(b.grupo || '')));
          }

          // Pagination slice
          const total = itemsFromSnap.length;
          const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
          const offset = (validPage - 1) * PAGE_LIMIT;
          const pageItems = itemsFromSnap.slice(offset, offset + PAGE_LIMIT);

          items = pageItems;
          paginationResp = {
            page: validPage,
            limit: PAGE_LIMIT,
            total,
            totalPages
          };

          // Populate available filters from preload if available (only if we haven't set them yet locally)
          if ((!availableFilters || !availableFilters.fabricantes || availableFilters.fabricantes.length === 0) && preloadState.availableFilters) {
            setAvailableFilters(preloadState.availableFilters);
          }

        } else {
          // fallback to API when no snapshot
          if (catalogState?.currentFilters?.tipo === "conjuntos") {
            const resp = await fetchConjuntosPaginated(validPage, PAGE_LIMIT, filters);

            if (!resp) throw new Error("No server response");

            items = Array.isArray(resp.data) ? resp.data : [];

            // Process conjuntos data - handle various possible field names
            items = items.map(it => {
              const descricao = it.descricao || it.desc || it.nome || it.description || it.name || "";
              const codigo = it.codigo || it.id || it.code || "";
              const grupo = it.grupo || it.category || it.group || "";

              return {
                codigo: String(codigo).trim(),
                descricao: String(descricao).trim(),
                grupo: String(grupo).trim(),
                tipo: "conjunto",
                conjuntos: Array.isArray(it.children) ? it.children : [],
                ...it
              };
            }).filter(it => it.codigo && it.descricao);

            if (resp.pagination && typeof resp.pagination === "object") {
              const total = Math.max(0, parseInt(resp.pagination.total) || 0);
              const limit = Math.max(1, parseInt(resp.pagination.limit) || PAGE_LIMIT);
              const calculatedTotalPages = Math.max(1, Math.ceil(total / limit));

              paginationResp = {
                page: Math.max(1, parseInt(resp.pagination.page) || validPage),
                limit: limit,
                total: total,
                totalPages: Math.max(1, parseInt(resp.pagination.totalPages) || calculatedTotalPages)
              };
            }
          } else {
            const resp = await fetchProductsPaginated(validPage, PAGE_LIMIT, filters);

            if (!resp) throw new Error("No server response");

            items = Array.isArray(resp.data) ? resp.data : [];

            if (catalogState?.currentFilters?.tipo === "produtos") {
              items = items.filter((p) => !p.conjuntosCount || p.conjuntosCount === 0);
            }

            // Process products data - handle various possible field names
            items = items.map(it => {
              const descricao = it.descricao || it.desc || it.nome || it.description || it.name || "";
              const codigo = it.codigo || it.id || it.code || "";
              const grupo = it.grupo || it.category || it.group || "";

              return {
                codigo: String(codigo).trim(),
                descricao: String(descricao).trim(),
                grupo: String(grupo).trim(),
                tipo: "produto",
                ...it
              };
            }).filter(it => it.codigo && it.descricao);

            const sortBy = catalogState?.currentFilters?.sortBy || "codigo";
            if (sortBy === "descricao") {
              items.sort((a, b) =>
                String(a.descricao || "").localeCompare(String(b.descricao || ""))
              );
            } else if (sortBy === "grupo") {
              items.sort((a, b) =>
                String(a.grupo || "").localeCompare(String(b.grupo || ""))
              );
            }

            if (resp.pagination && typeof resp.pagination === "object") {
              const total = Math.max(0, parseInt(resp.pagination.total) || 0);
              const limit = Math.max(1, parseInt(resp.pagination.limit) || PAGE_LIMIT);
              const calculatedTotalPages = Math.max(1, Math.ceil(total / limit));

              paginationResp = {
                page: Math.max(1, parseInt(resp.pagination.page) || validPage),
                limit: limit,
                total: total,
                totalPages: Math.max(1, parseInt(resp.pagination.totalPages) || calculatedTotalPages)
              };
            }
          }
        }

        // Debug log to see data structure
        if (items.length > 0) {
          console.log("First product data:", items[0]);
        }

        // If backend didn't provide fabricantes, derive them from returned items
        if ((!availableFilters.fabricantes || availableFilters.fabricantes.length === 0) && items.length > 0) {
          const fabricantesSet = new Set();
          items.forEach(it => {
            const f = (it.fabricante || it.marca || it.manufacturer || it.origem || it.fornecedor || "").toString().trim();
            if (f) fabricantesSet.add(f);
          });

          const fabricantesArr = Array.from(fabricantesSet).sort((a, b) => String(a).localeCompare(String(b)));
          if (fabricantesArr.length > 0) {
            // Store as objects {name, count} for consistency with backend
            setAvailableFilters(prev => ({ ...prev, fabricantes: fabricantesArr.map(n => ({ name: n, count: 0 })) }));
          }
        }

        // Ensure vehicleTypes have sensible defaults
        if (!availableFilters.vehicleTypes || availableFilters.vehicleTypes.length === 0) {
          setAvailableFilters(prev => ({ ...prev, vehicleTypes: ['Leve', 'Pesado'] }));
        }

      } catch (apiError) {
        const errorMsg = apiError?.message || "Error loading data";
        setError(errorMsg);
        items = [];
      }

      setProducts(items);
      setPagination(paginationResp);
      setImageErrors({});

      // Add loaded products to cache
      if (items.length > 0) {
        addToProductsCache(items);
      }
    } catch (err) {
      const errorMsg = err?.message || "Unknown error";
      setError(errorMsg);
      setProducts([]);
      setPagination({
        page: 1,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 0
      });
    } finally {
      setLoading(false);
    }
  }

  // Load filters on mount - now hardcoded, no need to fetch
  useEffect(() => {
    setFiltersLoaded(true);
  }, []);

  // Reload products when filters change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadProducts(catalogState.currentPage || 1);
  }, [catalogState.currentFilters, catalogState.currentPage]);

  // When tipoVeiculo is set to a canonical sigla, show an info tag in the results header
  useEffect(() => {
    const t = catalogState.currentFilters?.tipoVeiculo || '';
    // nothing else for now; UI tag is already shown in active filters section
  }, [catalogState.currentFilters?.tipoVeiculo]);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const nearBottom = (window.innerHeight + y) >= (docHeight - 120);
      setShowScrollTop(nearBottom);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Parse query params on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const page = parseInt(qs.get("page")) || catalogState.currentPage || 1;
    const search = qs.get("search") || catalogState.currentFilters.search || "";
    const grupo = qs.get("grupo") || catalogState.currentFilters.grupo || "";
    const tipo = qs.get("tipo") || catalogState.currentFilters.tipo || "";
    const fabricante = qs.get("fabricante") || catalogState.currentFilters.fabricante || "";
    const tipoVeiculo = qs.get("tipoVeiculo") || catalogState.currentFilters.tipoVeiculo || "";
    const sortBy = qs.get("sortBy") || catalogState.currentFilters.sortBy || "codigo";

    // Tipo definido pelo usuário ou padrão
    const finalTipo = tipo || "";

    updateCatalogState({
      currentPage: page,
      currentFilters: { search, grupo, tipo: finalTipo, fabricante, tipoVeiculo, sortBy }
    });
  }, []);

  // Sync URL with state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams();
    if (catalogState.currentPage) params.set("page", String(catalogState.currentPage));
    const f = catalogState.currentFilters || {};
    if (f.search) params.set("search", f.search);
    if (f.grupo) params.set("grupo", f.grupo);
    if (f.tipo) params.set("tipo", f.tipo);
    if (f.fabricante) params.set("fabricante", f.fabricante);
    if (f.tipoVeiculo) params.set("tipoVeiculo", f.tipoVeiculo);
    if (f.sortBy) params.set("sortBy", f.sortBy);

    const query = params.toString();
    const newUrl = query ? `${location.pathname}?${query}` : location.pathname;
    navigate(newUrl, { replace: true });
  }, [catalogState.currentFilters, catalogState.currentPage]);

  const handleFilterChange = (key, value) => {
    const nextFilters = {
      ...catalogState.currentFilters,
      [key]: value
    };

    updateCatalogState({
      currentFilters: nextFilters,
      currentPage: 1
    });
  };

  const handleResetFilters = () => {
    updateCatalogState({
      currentFilters: {
        search: "",
        grupo: "",
        tipo: "",
        fabricante: "",
        tipoVeiculo: "",
        sortBy: "codigo"
      },
      currentPage: 1
    });
  };

  const handlePageChange = (newPage) => {
    updateCatalogState({ currentPage: newPage });
    loadProducts(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductClick = (codigo) => {
    navigate(`/produtos/${encodeURIComponent(String(codigo))}`);
  };

  const handleImageError = (codigo) => {
    setImageErrors(prev => ({ ...prev, [codigo]: true }));
  };

  const getImageUrl = (codigo) => {
    if (!codigo) return "";
    return `/vista/${encodeURIComponent(codigo)}.jpg`;
  };

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalItems = pagination.total.toLocaleString();

  // Helper to get product description
  const getProductDescription = (product) => {
    if (!product) return "Sem descrição disponível";

    // Try multiple field names for description
    const desc = product.descricao || product.desc || product.nome ||
      product.description || product.name || product.titulo ||
      product.title || "";

    return desc || "Sem descrição disponível";
  };

  // Helper to get product code
  const getProductCode = (product) => {
    if (!product) return "";
    return product.codigo || product.code || product.id || "";
  };

  // Helper to get product group
  const getProductGroup = (product) => {
    if (!product) return "";
    return product.grupo || product.category || product.group || "Sem grupo";
  };

  return (
    <div className="catalog-wrapper">
      {/* Header */}
      <header className="catalog-header">
        <div className="header-container">
          <div className="header-brand">
            <h1 className="header-title">Catálogo ABR</h1>
            <p className="header-subtitle">Peças automotivas</p>
          </div>

          <div className="header-actions">
            <div className="stats-badge">
              <span className="stats-number">{totalItems}</span>
              <span className="stats-label">itens</span>
            </div>
            {/* Mobile-only fixed filter button (visible only on small screens) */}
            <button
              className="header-filter-btn"
              onClick={() => setFilterModalOpen(true)}
              aria-label="Abrir filtros"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="8" />
              </svg>
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="filter-count small">{activeFiltersCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="catalog-main">
        {/* Mobile Filter Toggle */}
        <div className="mobile-filter-toggle">
          <button
            className="filter-toggle-btn"
            onClick={() => setFilterModalOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 21l-4.35-4.35" />
              <circle cx="11" cy="11" r="8" />
            </svg>
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="filter-count">{activeFiltersCount}</span>
            )}
          </button>
        </div>

        <div className="catalog-layout">
          {/* Desktop Filters */}
          <aside className="catalog-filters">
            <div className="filters-header">
              <h2 className="filters-title">Filtros</h2>
              {activeFiltersCount > 0 && (
                <button
                  className="clear-filters-btn"
                  onClick={handleResetFilters}
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="filters-section">
              <div className="filter-group">
                <label className="filter-label">Buscar</label>
                <div className="search-wrapper">

                  <input
                    type="text"
                    placeholder="Código ou descrição..."
                    value={catalogState.currentFilters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="filter-group">
                <label className="filter-label">Tipo</label>
                <select
                  value={catalogState.currentFilters.tipo}
                  onChange={(e) => handleFilterChange("tipo", e.target.value)}
                  className="filter-select"
                >
                  <option value="">Todos</option>
                  <option value="produtos">Produtos</option>
                  <option value="conjuntos">Conjuntos</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Grupo</label>
                <select
                  value={catalogState.currentFilters.grupo}
                  onChange={(e) => handleFilterChange("grupo", e.target.value)}
                  className="filter-select"
                  disabled={!filtersLoaded}
                >
                  <option value="">{filtersLoaded ? "Todos os grupos" : "Carregando..."}</option>
                  {availableFilters.grupos?.map(grupo => (
                    <option key={grupo} value={grupo}>{grupo}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Fabricante</label>
                <select
                  value={catalogState.currentFilters.fabricante || ""}
                  onChange={(e) => handleFilterChange("fabricante", e.target.value)}
                  className="filter-select"
                  disabled={!filtersLoaded}
                >
                  <option value="">{filtersLoaded ? "Todos os fabricantes" : "Carregando..."}</option>
                  {availableFilters.fabricantes?.map(f => {
                    const name = (typeof f === 'string') ? f : (f && f.name ? f.name : '');
                    const count = (f && typeof f === 'object' && Number.isFinite(Number(f.count))) ? Number(f.count) : 0;
                    return (
                      <option key={name} value={name}>{name}{count ? ` (${count})` : ''}</option>
                    );
                  })}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Tipo de veículo</label>
                <select
                  value={catalogState.currentFilters.tipoVeiculo || ""}
                  onChange={(e) => handleFilterChange("tipoVeiculo", e.target.value)}
                  className="filter-select"
                  disabled={!filtersLoaded}
                >
                  <option value="">{filtersLoaded ? "Todos os tipos" : "Carregando..."}</option>
                  {availableFilters.vehicleTypes?.map(sigla => {
                    const labelMap = {
                      VLL: 'Veículo - Linha Leve (VLL)',
                      VLP: 'Veículo - Linha Pesada (VLP)',
                      MLL: 'Motor - Linha Leve (MLL)',
                      MLP: 'Motor - Linha Pesada (MLP)'
                    };
                    const upper = String(sigla).toUpperCase();
                    const label = labelMap[upper] || upper;
                    return <option key={upper} value={upper}>{label}</option>;
                  })}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Ordenar por</label>
                <select
                  value={catalogState.currentFilters.sortBy}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                  className="filter-select"
                >
                  <option value="codigo">Código</option>
                  <option value="descricao">Descrição</option>
                  <option value="grupo">Grupo</option>
                </select>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="active-filters-section">
                <h3 className="active-filters-title">Filtros ativos</h3>
                <div className="active-filters-tags">
                  {catalogState.currentFilters.search && (
                    <span className="filter-tag">
                      {catalogState.currentFilters.search}
                      <button onClick={() => handleFilterChange("search", "")}>
                        ×
                      </button>
                    </span>
                  )}
                  {catalogState.currentFilters.grupo && (
                    <span className="filter-tag">
                      {catalogState.currentFilters.grupo}
                      <button onClick={() => handleFilterChange("grupo", "")}>
                        ×
                      </button>
                    </span>
                  )}
                  {catalogState.currentFilters.tipo && (
                    <span className="filter-tag">
                      {catalogState.currentFilters.tipo}
                      <button onClick={() => handleFilterChange("tipo", "")}>
                        ×
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </aside>

          {/* Main Content */}
          <div className="catalog-content">
            {/* Results Header */}
            <div className="results-header">
              <div className="results-info">
                <span className="results-count">{totalItems} resultados</span>
                {pagination.totalPages > 1 && (
                  <span className="results-pages">Página {catalogState.currentPage} de {pagination.totalPages}</span>
                )}
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="loading-state">
                <LoadingSpinner />
                <p>Carregando produtos...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="error-state">
                <ErrorMessage
                  error={error}
                  onRetry={() => loadProducts(catalogState.currentPage)}
                />
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && products.length === 0 && (
              <EmptyState
                message="Nenhum produto encontrado"
                onAction={handleResetFilters}
                actionLabel="Limpar filtros"
              />
            )}

            {/* Products Grid */}
            {!loading && !error && products.length > 0 && (
              <>
                <div className="products-grid">
                  {products.map((product) => {
                    const productCode = getProductCode(product);
                    const productDescription = getProductDescription(product);
                    const productGroup = getProductGroup(product);

                    return (
                      <div
                        key={productCode}
                        className="product-card"
                        onClick={() => handleProductClick(productCode)}
                      >
                        <div className="product-image-container">
                          {!imageErrors[productCode] ? (
                            <img
                              src={getImageUrl(productCode)}
                              alt={productDescription}
                              className="product-image"
                              onError={() => handleImageError(productCode)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="image-placeholder">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            </div>
                          )}
                        </div>

                        <div className="product-info">
                          <div className="product-code-badge">
                            {productCode}
                          </div>

                          <h3 className="product-title" title={productDescription}>
                            {productDescription}
                          </h3>

                          <div className="product-meta">
                            {productGroup && productGroup !== "Sem grupo" && (
                              <span className="product-category" title={productGroup}>
                                {productGroup}
                              </span>
                            )}
                            {product.conjuntos && product.conjuntos.length > 0 && (
                              <span className="product-conjuntos">
                                {product.conjuntos.length} peças
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="product-actions">
                          <button
                            className="view-details-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductClick(productCode);
                            }}
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={catalogState.currentPage === 1}
                      onClick={() => handlePageChange(catalogState.currentPage - 1)}
                      className="pagination-btn prev"
                    >
                      ← Anterior
                    </button>

                    <div className="pagination-pages">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (catalogState.currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (catalogState.currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = catalogState.currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            className={`pagination-page ${catalogState.currentPage === pageNum ? 'active' : ''}`}
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      disabled={catalogState.currentPage === pagination.totalPages}
                      onClick={() => handlePageChange(catalogState.currentPage + 1)}
                      className="pagination-btn next"
                    >
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Filter Modal */}
      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        currentFilters={catalogState.currentFilters}
        onFilterChange={handleFilterChange}
        availableFilters={availableFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Scroll to Top */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={handleScrollToTop}
          aria-label="Voltar ao topo"
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default CatalogPage;