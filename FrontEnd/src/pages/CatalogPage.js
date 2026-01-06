import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FilterModal from "../components/FilterModal";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import Header from "../components/Header";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import useLazyLoad from '../hooks/useLazyLoad';
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
  const { clearHistory: clearHistoryOnLogout, pushState: navigateTo } = useNavigationHistory();
  const PAGE_LIMIT = 50;
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState(() => {
    // Initialize with preload data if available for instant loading
    if (preloadState && preloadState.loaded && preloadState.snapshot) {
      const snap = preloadState.snapshot;
      // Always show conjuntos since tipo filter was removed
      const items = Array.isArray(snap.conjuntos) ? snap.conjuntos.slice(0, PAGE_LIMIT) : [];

      return items.map(it => ({
        codigo: String(it.codigo || it.code || it.id || '').trim(),
        descricao: String(it.descricao || it.desc || it.nome || '').trim(),
        grupo: it.grupo || '',
        tipo: 'conjunto',
        ...it
      })).filter(it => it.codigo && it.descricao);
    }
    return [];
  });

  const [pagination, setPagination] = useState(() => {
    if (preloadState && preloadState.loaded && preloadState.snapshot) {
      const snap = preloadState.snapshot;
      // Always show conjuntos since tipo filter was removed
      const total = Array.isArray(snap.conjuntos) ? snap.conjuntos.length : 0;

      return {
        page: 1,
        limit: PAGE_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT))
      };
    }
    return {
      page: 1,
      limit: PAGE_LIMIT,
      total: 0,
      totalPages: 0
    };
  });

  const [availableFilters, setAvailableFilters] = useState(() => {
    // Always start with hardcoded filters, merge with preload if available
    const baseFilters = {
      grupos: HARDCODED_GRUPOS,
      subgrupos: [],
      fabricantes: HARDCODED_FABRICANTES.map(f => ({ name: f, count: 0 })), // Convert to objects for consistency
      vehicleTypes: []
    };

    if (preloadState && preloadState.availableFilters) {
      return {
        ...baseFilters,
        ...preloadState.availableFilters,
        // Always keep hardcoded groups and manufacturers
        grupos: HARDCODED_GRUPOS,
        fabricantes: HARDCODED_FABRICANTES.map(f => ({ name: f, count: 0 }))
      };
    }
    return baseFilters;
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(() => {
    // If we have preload data, don't show loading initially
    return !(preloadState && preloadState.loaded && preloadState.snapshot);
  });
  const [error, setError] = useState("");
  const { visibleItems: visibleImages, observeElement } = useLazyLoad({
    onVisible: (productCode) => {
      // Preload próximas 3 imagens quando uma fica visível
      const currentIndex = products.findIndex(p => getProductCode(p) === productCode);
      if (currentIndex !== -1) {
        const preloadCount = 3;
        for (let i = 1; i <= preloadCount; i++) {
          const nextIndex = currentIndex + i;
          if (nextIndex < products.length) {
            const nextProduct = products[nextIndex];
            const nextCode = getProductCode(nextProduct);
            if (nextCode) {
              // Preload image into browser cache
              try {
                const img = new Image();
                img.src = getImageUrl(nextCode);
              } catch (e) {
                // ignore preload errors
              }
              // Also start observing the element so it will be loaded when visible
              const el = document.querySelector(`[data-lazy-id="${nextCode}"]`);
              if (el) observeElement(el);
            }
          }
        }
      }
    }
  });

  // Observar imagens quando products muda
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const imageElements = document.querySelectorAll('[data-lazy-id]');
      imageElements.forEach((img) => observeElement(img));
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [products, observeElement]);
  const [imageErrors, setImageErrors] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(true); // Always true since we use hardcoded filters

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
        tipoVeiculo: catalogState?.currentFilters?.tipoVeiculo || "",
        isConjunto: catalogState?.currentFilters?.isConjunto
      };

      let items = [];
      let paginationResp = {
        page: validPage,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 0
      };

      try {
        let resp;
        if (filters.isConjunto === true) {
          // Load only conjuntos
          resp = await fetchConjuntosPaginated(validPage, PAGE_LIMIT, filters);
          items = Array.isArray(resp.data) ? resp.data : [];
          items = items.map(it => ({
            codigo: String(it.pai || it.codigo || "").trim(),
            descricao: String(it.descricao || "").trim(),
            grupo: String(it.grupo || "").trim(),
            tipo: "conjunto",
            ...it
          })).filter(it => it.codigo && it.descricao);
        } else if (filters.isConjunto === false) {
          // Load only products
          resp = await fetchProductsPaginated(validPage, PAGE_LIMIT, filters);
          items = Array.isArray(resp.data) ? resp.data : [];
          items = items.map(it => ({
            codigo: String(it.codigo_abr || it.codigo || "").trim(),
            descricao: String(it.descricao || "").trim(),
            grupo: String(it.grupo || "").trim(),
            tipo: "produto",
            ...it
          })).filter(it => it.codigo && it.descricao);
        } else {
          // Load both: conjuntos first, then products
          const [conjResp, prodResp] = await Promise.all([
            fetchConjuntosPaginated(1, Math.ceil(PAGE_LIMIT / 2), filters),
            fetchProductsPaginated(1, Math.floor(PAGE_LIMIT / 2), filters)
          ]);

          const conjItems = Array.isArray(conjResp.data) ? conjResp.data.map(it => ({
            codigo: String(it.pai || it.codigo || "").trim(),
            descricao: String(it.descricao || "").trim(),
            grupo: String(it.grupo || "").trim(),
            tipo: "conjunto",
            ...it
          })).filter(it => it.codigo && it.descricao) : [];

          const prodItems = Array.isArray(prodResp.data) ? prodResp.data.map(it => ({
            codigo: String(it.codigo_abr || it.codigo || "").trim(),
            descricao: String(it.descricao || "").trim(),
            grupo: String(it.grupo || "").trim(),
            tipo: "produto",
            ...it
          })).filter(it => it.codigo && it.descricao) : [];

          items = [...conjItems, ...prodItems];

          // For pagination, combine totals
          const totalConj = conjResp.pagination?.total || 0;
          const totalProd = prodResp.pagination?.total || 0;
          paginationResp.total = totalConj + totalProd;
          paginationResp.totalPages = Math.ceil(paginationResp.total / PAGE_LIMIT);
          paginationResp.page = validPage;
          paginationResp.limit = PAGE_LIMIT;
        }

        if (filters.isConjunto !== null && resp) {
          // For single type, use normal pagination
          if (resp.pagination && typeof resp.pagination === "object") {
            const total = Math.max(0, parseInt(resp.pagination.total) || 0);
            const limit = Math.max(1, parseInt(resp.pagination.limit) || PAGE_LIMIT);
            const totalPages = Math.ceil(total / limit);

            paginationResp = {
              page: Math.min(validPage, totalPages) || 1,
              limit,
              total,
              totalPages
            };
          }
        }

        // Debug log to see data structure
        if (items.length > 0) {
          console.log("First item data:", items[0]);
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
            // Merge with hardcoded manufacturers, keeping all hardcoded ones
            const mergedFabricantes = new Map();
            HARDCODED_FABRICANTES.forEach(f => mergedFabricantes.set(f, { name: f, count: 0 }));
            fabricantesArr.forEach(f => {
              if (!mergedFabricantes.has(f)) {
                mergedFabricantes.set(f, { name: f, count: 0 });
              }
            });
            setAvailableFilters(prev => ({ ...prev, fabricantes: Array.from(mergedFabricantes.values()) }));
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

  // Load filters on mount - now using hardcoded/initialized filters
  useEffect(() => {
    // Filters are now initialized above, no need to fetch
    setFiltersLoaded(true);
  }, []);

  // Load products when filters change - optimized to avoid unnecessary reloads
  useEffect(() => {
    // Always load since we removed tipo filter and always show conjuntos
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
    const fabricante = qs.get("fabricante") || catalogState.currentFilters.fabricante || "";
    const tipoVeiculo = qs.get("tipoVeiculo") || catalogState.currentFilters.tipoVeiculo || "";
    const sortBy = qs.get("sortBy") || catalogState.currentFilters.sortBy || "codigo";

    // Check if anything actually changed
    const currentFilters = catalogState.currentFilters || {};
    const hasChanges = page !== catalogState.currentPage ||
      search !== (currentFilters.search || "") ||
      grupo !== (currentFilters.grupo || "") ||
      fabricante !== (currentFilters.fabricante || "") ||
      tipoVeiculo !== (currentFilters.tipoVeiculo || "") ||
      sortBy !== (currentFilters.sortBy || "codigo");

    if (hasChanges) {
      updateCatalogState({
        currentPage: page,
        currentFilters: { search, grupo, fabricante, tipoVeiculo, sortBy }
      });
    }
  }, []);

  // Sync URL with state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const params = new URLSearchParams();
    if (catalogState.currentPage) params.set("page", String(catalogState.currentPage));
    const f = catalogState.currentFilters || {};
    if (f.search) params.set("search", f.search);
    if (f.grupo) params.set("grupo", f.grupo);
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
    const productUrl = `/produtos/${encodeURIComponent(String(codigo))}`;
    navigateTo(productUrl, {
      fromCatalog: true,
      catalogState: {
        page: catalogState.currentPage,
        filters: catalogState.currentFilters
      }
    });
  };

  const handleImageError = useCallback((codigo) => {
    setImageErrors(prev => ({ ...prev, [codigo]: true }));
  }, []);

  const getImageUrl = useCallback((codigo) => {
    if (!codigo) return "";
    return `/vista/${encodeURIComponent(codigo)}.jpg`;
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const totalItems = pagination.total.toLocaleString();

  // Helper to get product description
  const getProductDescription = useCallback((product) => {
    if (!product) return "Sem descrição disponível";

    // Try multiple field names for description
    const desc = product.descricao || product.desc || product.nome ||
      product.description || product.name || product.titulo ||
      product.title || "";

    return desc || "Sem descrição disponível";
  }, []);

  // Helper to get product code
  const getProductCode = useCallback((product) => {
    if (!product) return "";
    return product.codigo || product.code || product.id || "";
  }, []);

  // Helper to get product group
  const getProductGroup = useCallback((product) => {
    if (!product) return "";
    return product.grupo || product.category || product.group || "Sem grupo";
  }, []);

  return (
    <div className="catalog-wrapper">
      <Header onLogoClick={clearHistoryOnLogout}>
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
      </Header>

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
                <label className="filter-label">Grupo</label>
                <select
                  value={catalogState.currentFilters.grupo || ""}
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
                              src={visibleImages.has(productCode) ? getImageUrl(productCode) : ""}
                              alt={productDescription}
                              className="product-image"
                              onError={() => handleImageError(productCode)}
                              loading="lazy"
                              data-lazy-id={productCode}
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