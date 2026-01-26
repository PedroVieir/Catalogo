// src/pages/CatalogPage.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FilterModal from "../components/FilterModal";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import CookieConsent from "../components/CookieConsent";
import useLazyLoad from "../hooks/useLazyLoad";
import Header from "../components/Header";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import useAnalytics from "../hooks/useAnalytics";
import {
  fetchCatalogSnapshot,
  filterCatalogSnapshot,
} from "../services/productService";
import { useCatalogState } from "../contexts/CatalogContext";

const HARDCODED_FABRICANTES = [
  "AGRALE", "ASIA", "CASE", "CBT", "CITROEN", "CUMMINS",
  "DODGE", "ENGESA", "FIAT", "FIAT ALLIS", "FIAT/IVECO",
  "FORD", "FOTON", "GM CHEVROLET", "HONDA", "HYUNDAI",
  "IVECO", "JCB", "JEEP", "JOHN DEERE", "KIA", "KOMATSU",
  "LAND ROVER", "MAN", "MASSEY FERGUSON", "MERCEDES BENZ",
  "MITSUBISHI", "MWM", "NEW HOLLAND", "NISSAN",
  "PERKINS / MAXION / INTERNATIONAL", "PEUGEOT", "RENAULT",
  "SCANIA", "SUZUKI", "TOYOTA", "TROLLER", "VALTRA / VALMET",
  "VOLARE", "VOLKSWAGEN", "VOLVO",
];

const HARDCODED_GRUPOS = [
  "JOGOS DE JUNTAS", "JUNTA DO CARTER",
  "JUNTA DO COLETOR DE ADMISSÃO",
  "JUNTA DO COLETOR DE ADMISSÃO E ESCAPAMENTO",
  "JUNTA DO COLETOR DE ESCAPAMENTO", "JUNTAS DE CABEÇOTE",
  "JUNTAS DIVERSAS", "RETENTORES", "TAMPA DE VÁLVULA", "TAMPA FRONTAL",
];

const TIPO_VEICULO_OPCOES = [
  { value: "MOTOR", label: "Motor" },
  { value: "VEICULO", label: "Veículo" },
];

const LINHA_OPCOES = [
  { value: "LEVE", label: "Linha leve" },
  { value: "PESADA", label: "Linha pesada" },
];

const PAGE_LIMIT = 50;

function normalizeCodeForRoute(code) {
  if (!code) return "";
  return String(code).replace(/\s+/g, "").toUpperCase().trim();
}

function normalizeTipoVeiculo(v) {
  const up = String(v || "").trim().toUpperCase();
  if (!up) return "";
  if (up === "MOTOR" || up === "M") return "MOTOR";
  if (up === "VEICULO" || up === "VEÍCULO" || up === "V") return "VEICULO";
  // compat (siglas)
  if (up === "VLL" || up === "VLP" || up === "MLL" || up === "MLP") return up;
  return up;
}
function normalizeLinha(v) {
  const up = String(v || "").trim().toUpperCase();
  if (!up) return "";
  if (up === "LEVE" || up === "L") return "LEVE";
  if (up === "PESADA" || up === "PESADO" || up === "P") return "PESADA";
  // compat (siglas)
  if (up === "VLL" || up === "VLP" || up === "MLL" || up === "MLP") return up;
  return up;
}

function labelTipoVeiculo(v) {
  if (v === "MOTOR") return "Motor";
  if (v === "VEICULO") return "Veículo";
  return v || "";
}
function labelLinha(v) {
  if (v === "LEVE") return "Linha leve";
  if (v === "PESADA") return "Linha pesada";
  return v || "";
}

function CatalogPage() {
  const { catalogState, updateCatalogState, preloadState, addToProductsCache } = useCatalogState();
  const { clearHistory: clearHistoryOnLogout, pushState: navigateTo } = useNavigationHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);
  const sidebarRef = useRef(null);
  const touchStartX = useRef(0);

  const [catalogSnapshot, setCatalogSnapshot] = useState(() =>
    preloadState && preloadState.snapshot ? preloadState.snapshot : null
  );

  const [products, setProducts] = useState(() => {
    if (preloadState && preloadState.loaded && preloadState.snapshot) {
      const snap = preloadState.snapshot;
      const items = Array.isArray(snap.conjuntos) ? snap.conjuntos.slice(0, PAGE_LIMIT) : [];
      return items
        .map((it) => ({
          codigo: String(it.codigo || it.pai || it.id || "").trim(),
          descricao: String(it.descricao || it.desc || it.nome || "").trim(),
          grupo: it.grupo || "",
          tipo: "conjunto",
          ...it,
        }))
        .filter((it) => it.codigo && it.descricao);
    }
    return [];
  });

  const [pagination, setPagination] = useState(() => {
    if (preloadState && preloadState.loaded && preloadState.snapshot) {
      const snap = preloadState.snapshot;
      const total = Array.isArray(snap.conjuntos) ? snap.conjuntos.length : 0;
      return {
        page: 1,
        limit: PAGE_LIMIT,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)),
      };
    }
    return { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 };
  });

  // Removido setter (não usado) para evitar no-unused-vars
  const [availableFilters] = useState(() => {
    const baseFilters = {
      grupos: HARDCODED_GRUPOS,
      subgrupos: [],
      fabricantes: HARDCODED_FABRICANTES.map((f) => ({ name: f, count: 0 })),
      vehicleTypes: TIPO_VEICULO_OPCOES.map((v) => v.value),
      linhas: LINHA_OPCOES.map((l) => l.value),
    };
    if (preloadState && preloadState.availableFilters) {
      return {
        ...baseFilters,
        ...preloadState.availableFilters,
        grupos: HARDCODED_GRUPOS,
        fabricantes: HARDCODED_FABRICANTES.map((f) => ({ name: f, count: 0 })),
      };
    }
    return baseFilters;
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(() => !(preloadState && preloadState.loaded && preloadState.snapshot));
  const [error, setError] = useState("");
  const [imageErrors, setImageErrors] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filtersLoaded] = useState(true);

  const [analyticsPreferences, setAnalyticsPreferences] = useState(null);
  useAnalytics(analyticsPreferences);

  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    const handler = (ev) => {
      try {
        console.warn("Unhandled promise rejection (suppressed):", ev.reason);
        ev.preventDefault && ev.preventDefault();
      } catch (e) { }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  const getProductCode = useCallback((product) => {
    if (!product) return "";
    return ((product.codigo || product.code || product.id || "")).toString().trim();
  }, []);

  const getProductDescription = useCallback((product) => {
    if (!product) return "Sem descrição disponível";
    return (
      product.descricao ||
      product.desc ||
      product.nome ||
      product.description ||
      product.name ||
      "Sem descrição disponível"
    );
  }, []);

  const getProductGroup = useCallback((product) => {
    if (!product) return "";
    return product.grupo || product.category || product.group || "Sem grupo";
  }, []);

  const getImageUrl = useCallback((codigo) => {
    if (!codigo) return null;
    return `/vista/${encodeURIComponent(codigo)}.jpg`;
  }, []);

  const totalItems = useMemo(() => (pagination.total || 0).toLocaleString(), [pagination.total]);

  const isSnapshotValid = useCallback(() => !!catalogSnapshot, [catalogSnapshot]);

  async function ensureSnapshot(force = false) {
    if (!force && catalogSnapshot && isSnapshotValid()) return catalogSnapshot;

    try {
      const snap = await fetchCatalogSnapshot(force);
      if (!snap || typeof snap !== "object") throw new Error("Snapshot inválido");
      if (!mountedRef.current) return snap;
      setCatalogSnapshot(snap);
      return snap;
    } catch (err) {
      // Mantém comportamento de fallback (API) já implementado em loadProducts
      console.warn("Erro ao carregar snapshot:", err?.message || err);
      throw err;
    }
  }

  async function loadProducts(page = 1) {
    if (!mountedRef.current) return;
    setLoading(true);
    setError("");

    try {
      const filters = {
        search: catalogState?.currentFilters?.search || "",
        grupo: catalogState?.currentFilters?.grupo || "",
        fabricante: catalogState?.currentFilters?.fabricante || "",
        tipoVeiculo: catalogState?.currentFilters?.tipoVeiculo || "",
        linha: catalogState?.currentFilters?.linha || "",
        sortBy: catalogState?.currentFilters?.sortBy || "codigo",
        isConjunto: catalogState?.currentFilters?.isConjunto,
      };

      let snap = null; // <-- DEFINA AQUI (escopo externo)

      try {
        snap = await ensureSnapshot(false); // <-- ATRIBUA AQUI
        if (snap && typeof snap === "object") {
          const result = filterCatalogSnapshot(snap, filters, page, PAGE_LIMIT);
          if (!mountedRef.current) return;
          setProducts(result.data);
          setPagination(result.pagination);
          setImageErrors({});
          if (result.data.length > 0 && typeof addToProductsCache === "function") {
            addToProductsCache(result.data);
          }
          setLoading(false);
          return;
        }
      } catch (snapErr) {
        console.log("[LoadProducts] Snapshot inválido, forçando reload...");
      }

      // APENAS use snapshot - SEM requisições adicionais de rede
      if (!snap || typeof snap !== "object") {
        throw new Error("Catálogo indisponível");
      }

      const result = filterCatalogSnapshot(snap, filters, page, PAGE_LIMIT);
      if (!mountedRef.current) return;
      setProducts(result.data);
      setPagination(result.pagination);
      setImageErrors({});
      if (result.data.length > 0 && typeof addToProductsCache === "function") {
        addToProductsCache(result.data);
      }
      console.log("[LoadProducts] ✓ Sucesso (snapshot):", result.data.length, "itens");
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Erro ao carregar produtos:", err);
      setError(err?.message || "Erro inesperado");
      setProducts([]);
      setPagination({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }


  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        if (!catalogSnapshot) {
          await ensureSnapshot(false).catch(() => { });
        }
      } finally {
        loadProducts(catalogState.currentPage || 1);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchDebounceRef = useRef(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadProducts(catalogState.currentPage || 1);
    }, 220);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogState.currentFilters, catalogState.currentPage]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset;
      const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const nearBottom = window.innerHeight + y >= docHeight - 120;
      setShowScrollTop(nearBottom);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { visibleItems: visibleImages, observeElement } = useLazyLoad({ onVisible: () => { } });

  useEffect(() => {
    if (!products || !products.length) return;
    const timeoutId = setTimeout(() => {
      const imageElements = document.querySelectorAll("[data-lazy-id]");
      const batchSize = 10;
      let processed = 0;
      const processBatch = () => {
        const batch = Array.from(imageElements).slice(processed, processed + batchSize);
        batch.forEach((img) => observeElement(img));
        processed += batchSize;
        if (processed < imageElements.length) setTimeout(processBatch, 0);
      };
      processBatch();
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [products, observeElement]);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const page = parseInt(qs.get("page")) || catalogState.currentPage || 1;
    const search = qs.get("search") || catalogState.currentFilters?.search || "";
    const grupo = qs.get("grupo") || catalogState.currentFilters?.grupo || "";
    const fabricante = qs.get("fabricante") || "";
    const tipoVeiculo = normalizeTipoVeiculo(qs.get("tipoVeiculo") || catalogState.currentFilters?.tipoVeiculo || "");
    const linha = normalizeLinha(qs.get("linha") || catalogState.currentFilters?.linha || "");
    const sortBy = qs.get("sortBy") || catalogState.currentFilters?.sortBy || "grupo";

    const currentFilters = catalogState.currentFilters || {};
    const hasChanges =
      page !== catalogState.currentPage ||
      search !== (currentFilters.search || "") ||
      grupo !== (currentFilters.grupo || "") ||
      fabricante !== (currentFilters.fabricante || "") ||
      tipoVeiculo !== (currentFilters.tipoVeiculo || "") ||
      linha !== (currentFilters.linha || "") ||
      sortBy !== (currentFilters.sortBy || "grupo");

    if (hasChanges) {
      updateCatalogState({
        currentPage: page,
        currentFilters: { search, grupo, fabricante: fabricante || "", tipoVeiculo, linha, sortBy },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (catalogState.currentPage) params.set("page", String(catalogState.currentPage));
    const f = catalogState.currentFilters || {};
    if (f.search) params.set("search", f.search);
    if (f.grupo) params.set("grupo", f.grupo);
    if (f.fabricante) params.set("fabricante", f.fabricante);
    if (f.tipoVeiculo) params.set("tipoVeiculo", f.tipoVeiculo);
    if (f.linha) params.set("linha", f.linha);
    if (f.sortBy) params.set("sortBy", f.sortBy);
    const query = params.toString();
    const newUrl = query ? `${location.pathname}?${query}` : location.pathname;
    navigate(newUrl, { replace: true });
  }, [catalogState.currentFilters, catalogState.currentPage, navigate, location.pathname]);

  useEffect(() => {
    if (loading) {
      const startTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressValue = Math.min(100 * (1 - Math.exp(-elapsed / 2000)), 95);
        setProgress(progressValue);
      }, 100);
    } else {
      setProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [loading]);

  const activeFilters = useMemo(() => {
    const f = catalogState.currentFilters || {};
    const entries = [];
    if (f.search) entries.push({ key: "search", label: f.search });
    if (f.grupo) entries.push({ key: "grupo", label: f.grupo });
    if (f.fabricante) entries.push({ key: "fabricante", label: f.fabricante });
    if (f.tipoVeiculo) entries.push({ key: "tipoVeiculo", label: labelTipoVeiculo(f.tipoVeiculo) });
    if (f.linha) entries.push({ key: "linha", label: labelLinha(f.linha) });
    return entries;
  }, [catalogState.currentFilters]);
  const activeFiltersCount = activeFilters.length;

  const handleFilterChange = (key, value) => {
    let normalized = typeof value === "string" ? value : value == null ? "" : String(value);
    if (key === "tipoVeiculo") normalized = normalizeTipoVeiculo(normalized);
    if (key === "linha") normalized = normalizeLinha(normalized);

    updateCatalogState({
      currentFilters: { ...catalogState.currentFilters, [key]: normalized },
      currentPage: 1,
    });
  };

  const handleRemoveFilter = (key) => {
    updateCatalogState({
      currentFilters: { ...catalogState.currentFilters, [key]: "" },
      currentPage: 1,
    });
  };

  const handleResetFilters = () => {
    updateCatalogState({
      currentFilters: {
        search: "",
        grupo: "",
        fabricante: "",
        tipoVeiculo: "",
        linha: "",
        sortBy: "grupo",
      },
      currentPage: 1,
    });
  };

  const handlePageChange = (newPage) => {
    updateCatalogState({ currentPage: newPage });
    loadProducts(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleProductClick = (codigo) => {
    const raw = (codigo || "").toString().trim();
    if (!raw) {
      setError("Código do produto inválido");
      return;
    }
    const normalized = normalizeCodeForRoute(raw);
    const productUrl = `/produtos/${encodeURIComponent(normalized)}`;

    navigate(productUrl, {
      state: {
        fromCatalog: true,
        catalogState: { page: catalogState.currentPage, filters: catalogState.currentFilters },
      },
    });

    if (typeof navigateTo === "function") {
      setTimeout(() => {
        try {
          navigateTo(productUrl, {
            fromCatalog: true,
            catalogState: { page: catalogState.currentPage, filters: catalogState.currentFilters },
          });
        } catch (e) { }
      }, 0);
    }
  };

  const handleImageError = useCallback((codigo) => {
    setImageErrors((prev) => ({ ...prev, [codigo]: true }));
  }, []);

  const handleScrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: "smooth" }), []);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (diff > 50) setSidebarOpen(false);
  }, []);

  return (
    <div className="catalog-wrapper">
      <Header onLogoClick={clearHistoryOnLogout}>
        <div className="stats-badge">
          <span className="stats-number">{totalItems}</span>
          <span className="stats-label">itens</span>
        </div>

        <button
          className="header-filter-btn"
          onClick={() => {
            if (window.innerWidth <= 768) setSidebarOpen(true);
            else setFilterModalOpen(true);
          }}
          aria-label="Abrir filtros"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 21l-4.35-4.35" />
            <circle cx="11" cy="11" r="8" />
          </svg>
          <span>Filtros</span>
          {activeFiltersCount > 0 && <span className="filter-count small">{activeFiltersCount}</span>}
        </button>
      </Header>

      <main className="catalog-main">
        <div className="catalog-layout">
          <aside
            ref={sidebarRef}
            className={`catalog-filters ${sidebarOpen ? "open" : ""}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="filters-header">
              <h2 className="filters-title">Filtros</h2>
              <div className="filters-header-actions">
                <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)} aria-label="Fechar filtros">×</button>
                {activeFiltersCount > 0 ? (
                  <button className="clear-filters-btn" onClick={handleResetFilters}>Limpar</button>
                ) : null}
              </div>
            </div>

            <div className="filters-section">
              <div className="filter-group">
                <label className="filter-label">Buscar</label>
                <div className="search-wrapper">
                  <input
                    type="text"
                    placeholder="Buscar por Código ou descrição..."
                    value={catalogState.currentFilters.search || ""}
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
                  {HARDCODED_GRUPOS.map((gr) => (
                    <option key={gr} value={gr}>{gr}</option>
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
                  {HARDCODED_FABRICANTES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
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
                  <option value="">{filtersLoaded ? "Todos" : "Carregando..."}</option>
                  {TIPO_VEICULO_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Linha</label>
                <select
                  value={catalogState.currentFilters.linha || ""}
                  onChange={(e) => handleFilterChange("linha", e.target.value)}
                  className="filter-select"
                  disabled={!filtersLoaded}
                >
                  <option value="">{filtersLoaded ? "Todas" : "Carregando..."}</option>
                  {LINHA_OPCOES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Ordenar por</label>
                <select
                  value={catalogState.currentFilters.sortBy || "codigo"}
                  onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                  className="filter-select"
                >
                  <option value="codigo">Código</option>
                  <option value="descricao">Descrição</option>
                  <option value="grupo">Grupo</option>
                </select>
              </div>

              {activeFiltersCount > 0 && (
                <div className="active-filters-section" style={{ marginTop: 12 }}>
                  <h3 className="active-filters-title">Filtros ativos ({activeFiltersCount})</h3>
                  <div className="active-filters-tags">
                    {activeFilters.map((f) => (
                      <span key={f.key} className="filter-tag">
                        {f.label}
                        <button onClick={() => handleRemoveFilter(f.key)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          <div className="catalog-content">
            <div className="results-header">
              <div className="results-info">
                <span className="results-count">{totalItems} resultados</span>
                {pagination.totalPages > 1 && (
                  <span className="results-pages">
                    Página {catalogState.currentPage} de {pagination.totalPages}
                  </span>
                )}
              </div>
            </div>

            {loading && (
              <div className="loading-progress-container">
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="progress-text">Carregando produtos... {progress.toFixed(2)}%</p>
              </div>
            )}

            {error && !loading && (
              <div className="error-state">
                <ErrorMessage error={error} onRetry={() => loadProducts(catalogState.currentPage)} variant="banner" />
              </div>
            )}

            {!loading && !error && products.length === 0 && (
              <EmptyState message="Nenhum produto encontrado" onAction={handleResetFilters} actionLabel="Limpar filtros" />
            )}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="products-grid">
                  {products.map((product) => {
                    const productCode = getProductCode(product);
                    const productDescription = getProductDescription(product);
                    const productGroup = getProductGroup(product);
                    const key = `${product.tipo || "p"}-${productCode}`;
                    return (
                      <ProductCard
                        key={key}
                        product={product}
                        productCode={productCode}
                        productDescription={productDescription}
                        productGroup={productGroup}
                        visibleImages={visibleImages}
                        imageErrors={imageErrors}
                        getImageUrl={getImageUrl}
                        onImageError={handleImageError}
                        onProductClick={handleProductClick}
                        observeElement={observeElement}
                      />
                    );
                  })}
                </div>

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
                        if (pagination.totalPages <= 5) pageNum = i + 1;
                        else if (catalogState.currentPage <= 3) pageNum = i + 1;
                        else if (catalogState.currentPage >= pagination.totalPages - 2) pageNum = pagination.totalPages - 4 + i;
                        else pageNum = catalogState.currentPage - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            className={`pagination-page ${catalogState.currentPage === pageNum ? "active" : ""}`}
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

      <div className={`sidebar-overlay ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)}></div>

      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        currentFilters={catalogState.currentFilters}
        onFilterChange={handleFilterChange}
        availableFilters={availableFilters}
        onResetFilters={handleResetFilters}
      />

      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => handleScrollToTop()} aria-label="Voltar ao topo">
          ↑
        </button>
      )}

      <CookieConsent onAccept={(preferences) => setAnalyticsPreferences(preferences)} />
    </div>
  );
}

export default CatalogPage;

const ProductCard = React.memo(
  ({
    product,
    productCode,
    productDescription,
    productGroup,
    visibleImages,
    imageErrors,
    getImageUrl,
    onImageError,
    onProductClick,
    observeElement,
  }) => {
    useEffect(() => {
      try {
        const imgElement = document.querySelector(`[data-lazy-id="${productCode}"]`);
        if (imgElement) observeElement(imgElement);
      } catch (e) { }
    }, [productCode, observeElement]);

    const src = visibleImages.has(productCode) ? getImageUrl(productCode) : null;

    return (
      <div className="product-card" onClick={() => onProductClick(productCode)}>
        <div className="product-image-container">
          {!imageErrors[productCode] ? (
            <img
              src={src}
              alt={productDescription}
              className="product-image"
              onError={() => onImageError(productCode)}
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
          <div className="product-code-badge">{productCode}</div>

          <h3 className="product-title" title={productDescription}>
            {productDescription}
          </h3>

          <div className="product-meta">
            {productGroup && productGroup !== "Sem grupo" && (
              <span className="product-category" title={productGroup}>
                {productGroup}
              </span>
            )}
            {(() => {
              const children = product.conjuntosChildren || product.conjuntos;
              const count = Array.isArray(children) ? children.length : 0;
              if (count > 0) {
                return <span className="product-conjuntos">{count} peça{count > 1 ? "s" : ""}</span>;
              }
              return null;
            })()}
          </div>
        </div>

        <div className="product-actions">
          <button
            className="view-details-btn"
            onClick={(e) => {
              e.stopPropagation();
              onProductClick(productCode);
            }}
          >
            Ver detalhes
          </button>
        </div>
      </div>
    );
  }
);
