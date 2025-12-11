import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotification } from "../hooks/useNotification";
import Header from "../components/Header";
import ProductList from "../components/ProductList";
import FilterModal from "../components/FilterModal";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import FeedbackBanner from "../components/FeedbackBanner";
import { useCatalogState } from "../contexts/CatalogContext";
import {
  fetchProductsPaginated,
  fetchConjuntosPaginated,
  fetchFilters
} from "../services/productService";
import "../styles/CatalogPage.css";

function CatalogPage() {
  const { catalogState, updateCatalogState } = useCatalogState();
  const notify = useNotification();
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
    grupos: [],
    subgrupos: []
  });
  const [expanded, setExpanded] = useState(null);
  const [filtersHidden, setFiltersHidden] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);

  // Infer whether current listing is 'produtos' or 'conjuntos'
  const inferredListingType = (() => {
    const tipo = catalogState?.currentFilters?.tipo;
    if (tipo === "conjuntos") return "conjuntos";
    if (tipo === "produtos") return "produtos";
    if (products && products.length > 0) {
      const first = products[0];
      if (first && Object.prototype.hasOwnProperty.call(first, 'conjuntos')) return "conjuntos";
    }
    return "produtos";
  })();

  // Carrega produtos com filtros atuais
  async function loadProducts(page = 1) {
    try {
      setLoading(true);
      setError("");

      // Validar página
      const validPage = Math.max(1, Math.floor(page) || 1);

      const filters = {
        search: catalogState?.currentFilters?.search || "",
        grupo: catalogState?.currentFilters?.grupo || "",
        subgrupo: catalogState?.currentFilters?.subgrupo || ""
      };

      let items = [];
      let paginationResp = {
        page: validPage,
        limit: PAGE_LIMIT,
        total: 0,
        totalPages: 0
      };

      try {
        if (catalogState?.currentFilters?.tipo === "conjuntos") {
          // Buscar conjuntos
          const resp = await fetchConjuntosPaginated(validPage, PAGE_LIMIT, filters);
          
          // Validação defensiva da resposta
          if (!resp) {
            throw new Error("Resposta vazia do servidor");
          }

          items = Array.isArray(resp.data) ? resp.data : [];
          
          // Normalizar resposta do backend
          items = items.map(it => ({
            codigo: String(it.codigo || it.pai || it.id || "").trim(),
            descricao: String(it.descricao || it.nome || "").trim(),
            grupo: String(it.grupo || "").trim(),
            conjuntos: Array.isArray(it.children) ? it.children : []
          })).filter(it => it.codigo);

          // Atualizar paginação
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
          } else if (items.length > 0) {
            // Fallback: calcular baseado no tamanho dos items
            const total = Math.max(items.length, PAGE_LIMIT);
            paginationResp = {
              page: validPage,
              limit: PAGE_LIMIT,
              total: total,
              totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT))
            };
          }
        } else {
          // Buscar produtos
          const resp = await fetchProductsPaginated(validPage, PAGE_LIMIT, filters);
          
          // Validação defensiva da resposta
          if (!resp) {
            throw new Error("Resposta vazia do servidor");
          }

          items = Array.isArray(resp.data) ? resp.data : [];
          
          // Filtrar apenas produtos (sem conjuntos)
          if (catalogState?.currentFilters?.tipo === "produtos") {
            items = items.filter((p) => !p.conjuntosCount || p.conjuntosCount === 0);
          }

          // Aplicar ordenação
          const sortBy = catalogState?.currentFilters?.sortBy || "";
          if (sortBy === "descricao") {
            items.sort((a, b) => 
              String(a.descricao || "").localeCompare(String(b.descricao || ""))
            );
          } else if (sortBy === "grupo") {
            items.sort((a, b) => 
              String(a.grupo || "").localeCompare(String(b.grupo || ""))
            );
          }

          // Atualizar paginação
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
          } else if (items.length > 0) {
            // Fallback: calcular baseado no tamanho dos items
            const total = Math.max(items.length, PAGE_LIMIT);
            paginationResp = {
              page: validPage,
              limit: PAGE_LIMIT,
              total: total,
              totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT))
            };
          }
        }
      } catch (apiError) {
        // Erro específico da API
        const errorMsg = apiError?.message || "Erro ao carregar dados do servidor";
        console.error("Erro da API:", errorMsg);
        notify.error(errorMsg);
        setError(errorMsg);
        items = [];
      }

      setProducts(items);
      setPagination(paginationResp);
    } catch (err) {
      // Erro geral
      const errorMsg = err?.message || "Erro desconhecido ao carregar produtos";
      console.error("Erro geral:", errorMsg);
      notify.error("Falha ao carregar dados. Tente novamente.");
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

  // Carrega filtros disponíveis na inicialização
  useEffect(() => {
    async function loadFilters() {
      try {
        const data = await fetchFilters();
        
        // Validação defensiva da resposta
        if (!data || typeof data !== "object") {
          console.warn("Resposta de filtros inválida, usando padrão");
          setAvailableFilters({ grupos: [], subgrupos: [] });
          return;
        }

        setAvailableFilters({
          grupos: Array.isArray(data.grupos) ? data.grupos : [],
          subgrupos: Array.isArray(data.subgrupos) ? data.subgrupos : []
        });
      } catch (err) {
        console.warn("Erro ao carregar filtros:", err.message);
        notify.warning("Alguns filtros não puderam ser carregados.");
        // Usar valores padrão em caso de erro
        setAvailableFilters({ grupos: [], subgrupos: [] });
      }
    }

    loadFilters();
  }, []);

  // Recarrega produtos quando filtros mudam
  useEffect(() => {
    loadProducts(catalogState.currentPage || 1);
  }, [catalogState.currentFilters, catalogState.currentPage]);

  // Hide filters when scrolling down, show when scrolling up (MOBILE ONLY)
  useEffect(() => {
    const isMobileView = () => window.innerWidth <= 768;
    
    if (!isMobileView()) {
      // Desktop: sempre mostrar
      setFiltersHidden(false);
      return;
    }

    let lastY = window.scrollY || 0;
    let hideTimer = null;

    const handleScroll = () => {
      const currentY = window.scrollY || 0;
      
      // Clear any pending timer
      if (hideTimer) clearTimeout(hideTimer);

      // Detectar direção
      if (currentY > lastY + 3) {
        // Scrolling DOWN
        hideTimer = setTimeout(() => setFiltersHidden(true), 100);
      } else if (currentY < lastY - 3) {
        // Scrolling UP
        setFiltersHidden(false);
      }

      lastY = currentY;
    };

    const handleResize = () => {
      if (!isMobileView()) {
        setFiltersHidden(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  // On mount: parse query params and initialize catalog state
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const page = parseInt(qs.get("page")) || catalogState.currentPage || 1;
    const search = qs.get("search") || catalogState.currentFilters.search || "";
    const grupo = qs.get("grupo") || catalogState.currentFilters.grupo || "";
    const subgrupo = qs.get("subgrupo") || catalogState.currentFilters.subgrupo || "";
    const tipo = qs.get("tipo") || catalogState.currentFilters.tipo || "";
    const sortBy = qs.get("sortBy") || catalogState.currentFilters.sortBy || "codigo";
    const expandedParam = qs.get("expanded") || null;

    // Initialize context state from query
    updateCatalogState({
      currentPage: page,
      currentFilters: { search, grupo, subgrupo, tipo, sortBy }
    });

    setExpanded(expandedParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL when filters/page/expanded change
  useEffect(() => {
    const params = new URLSearchParams();
    if (catalogState.currentPage) params.set("page", String(catalogState.currentPage));
    const f = catalogState.currentFilters || {};
    if (f.search) params.set("search", f.search);
    if (f.grupo) params.set("grupo", f.grupo);
    if (f.subgrupo) params.set("subgrupo", f.subgrupo);
    if (f.tipo) params.set("tipo", f.tipo);
    if (f.sortBy) params.set("sortBy", f.sortBy);
    if (expanded) params.set("expanded", expanded);

    const query = params.toString();
    const newUrl = query ? `${location.pathname}?${query}` : location.pathname;
    // replace so we don't fill history for every small change
    navigate(newUrl, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogState.currentFilters, catalogState.currentPage, expanded]);

  const handleFilterChange = (key, value) => {
    const filterLabels = {
      search: "busca",
      grupo: "grupo",
      subgrupo: "subgrupo",
      tipo: "tipo de produto",
      sortBy: "ordenação"
    };

    if (value) {
      notify.info(`Filtro de ${filterLabels[key]} aplicado`);
    }

    updateCatalogState({
      currentFilters: {
        ...catalogState.currentFilters,
        [key]: value
      },
      currentPage: 1
    });
  };

  const handleResetFilters = () => {
    notify.info("Filtros limpos");
    updateCatalogState({
      currentFilters: {
        search: "",
        grupo: "",
        subgrupo: "",
        tipo: "",
        sortBy: "codigo"
      },
      currentPage: 1
    });
  };

  const handlePageChange = (newPage) => {
    notify.info(`Navegando para página ${newPage}`);
    updateCatalogState({ currentPage: newPage });
    loadProducts(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleConjuntoSelect = (codigo) => {
    setExpanded((prev) => (prev === codigo ? null : codigo));
  };

  return (
    <>
      <Header />

      <main className="catalog-main">
        <div className="page-header-row">
          <h1 id="title">Catálogo Eletrônico ABR</h1>
          <a href="https://abr.ind.br/" className="abr-back-link">
            <span className="abr-back-link-icon" aria-hidden="true">←</span>
            <span>Site ABR</span>
          </a>
        </div>

        <div className="catalog-container">
          {/* Sidebar de Filtros - Desktop Only */}
          <aside className={`filters-sidebar ${filtersHidden ? 'hidden' : ''}`}>
            <h2>Filtros</h2>

            <div className="filter-group">
              <label>Busca por Nome/Código</label>
              <input
                type="text"
                placeholder="Digite para buscar..."
                value={catalogState.currentFilters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="filter-input"
              />
            </div>

            <div className="filter-group">
              <label>Tipo</label>
              <select
                value={catalogState.currentFilters.tipo}
                onChange={(e) => handleFilterChange("tipo", e.target.value)}
                className="filter-select"
              >
                <option value="">Todos</option>
                <option value="produtos">Apenas Produtos</option>
                <option value="conjuntos">Apenas Conjuntos</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Grupo</label>
              <select
                value={catalogState.currentFilters.grupo}
                onChange={(e) => handleFilterChange("grupo", e.target.value)}
                className="filter-select"
              >
                <option value="">Todos os grupos</option>
                {availableFilters.grupos?.map(grupo => (
                  <option key={grupo} value={grupo}>{grupo}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Subgrupo</label>
              <select
                value={catalogState.currentFilters.subgrupo}
                onChange={(e) => handleFilterChange("subgrupo", e.target.value)}
                className="filter-select"
              >
                <option value="">Todos os subgrupos</option>
                {availableFilters.subgrupos?.map(subgrupo => (
                  <option key={subgrupo} value={subgrupo}>{subgrupo}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Ordenar Por</label>
              <select
                value={catalogState.currentFilters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="filter-select"
              >
                <option value="codigo">Código</option>
                <option value="descricao">Descrição (A-Z)</option>
                <option value="grupo">Categoria (A-Z)</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="filter-reset-btn"
            >
              Limpar Filtros
            </button>
          </aside>

          {/* Conteúdo Principal */}
          <div className="catalog-content">
            {/* Mobile Filter Button */}
            <div className="mobile-filter-bar">
              <button 
                className="mobile-filter-btn btn btn-primary"
                onClick={() => setFilterModalOpen(true)}
                aria-label="Abrir filtros"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden style={{marginRight:8}}>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
                <span>Filtros</span>
              </button>
            </div>

            {/* Informações de Resultados */}
            {!loading && (
              <div className="results-info">
                <span className="results-count">
                  {pagination.total} {inferredListingType} encontrados
                </span>
              </div>
            )}

            {/* Loading handled inside ProductTable (skeleton). Keep spinner for legacy fallback */}
            {/* ProductTable will render skeleton rows when `loading` is true */}

            {/* Erro */}
                  {error && !loading && (
                    <FeedbackBanner
                      type="error"
                      title="Erro ao carregar"
                      message={error}
                      onClose={() => setError("")}
                      action={() => loadProducts(catalogState.currentPage)}
                      actionLabel="Tentar novamente"
                    />
                  )}

            {/* Sem Resultados */}
            {!loading && !error && products.length === 0 && (
              <EmptyState 
                message="Nenhum produto encontrado com os filtros aplicados."
                onAction={() => { handleResetFilters(); notify.info('Filtros resetados'); }}
                actionLabel="Limpar Filtros"
              />
            )}

            {/* Tabela de Produtos */}
            { !error && (
              <>
                <ProductList items={products} loading={loading} onConjuntoSelect={handleConjuntoSelect} isConjuntosView={catalogState.currentFilters.tipo === 'conjuntos'} />

                {/* Paginação */}
                {pagination.total > pagination.limit && pagination.totalPages > 1 && !loading && (
                  <div className="pagination">
                    <button
                      disabled={catalogState.currentPage === 1}
                      onClick={() => handlePageChange(catalogState.currentPage - 1)}
                      className="pagination-btn"
                      aria-label="Página anterior"
                    >
                      ← Anterior
                    </button>

                    <span className="pagination-info">
                      Página {catalogState.currentPage} de {pagination.totalPages}
                    </span>

                    <button
                      disabled={catalogState.currentPage === pagination.totalPages}
                      onClick={() => handlePageChange(catalogState.currentPage + 1)}
                      className="pagination-btn"
                      aria-label="Próxima página"
                    >
                      Próximo →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Filter Modal - Mobile Only */}
      <FilterModal 
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        currentFilters={catalogState.currentFilters}
        onFilterChange={handleFilterChange}
        availableFilters={availableFilters}
        onResetFilters={handleResetFilters}
      />

      <footer>COPYRIGHT 2014 ABR IND. ALL RIGHTS RESERVED.</footer>
    </>
  );
}

export default CatalogPage;
