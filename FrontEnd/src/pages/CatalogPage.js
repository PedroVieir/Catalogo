// src/pages/CatalogPage.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FilterModal from "../components/FilterModal";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import EmptyState from "../components/EmptyState";
import useLazyLoad from '../hooks/useLazyLoad';
import Header from "../components/Header";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import {
  fetchProductsPaginated,
  fetchConjuntosPaginated,
  fetchCatalogSnapshot
} from "../services/productService";
import { useCatalogState } from "../contexts/CatalogContext";

// Hardcoded filters - kept exactly as requested
const HARDCODED_FABRICANTES = [
  "AGRALE", "ASIA", "CASE", "CBT", "CITROEN", "CUMMINS", "DODGE", "ENGESA", "FIAT", "FIAT ALLIS",
  "FIAT/IVECO", "FORD", "FOTON", "GM CHEVROLET", "HONDA", "HYUNDAI", "IVECO", "JCB", "JEEP",
  "JOHN DEERE", "KIA", "KOMATSU", "LAND ROVER", "MAN", "MASSEY FERGUSON", "MERCEDES BENZ",
  "MITSUBISHI", "MWM", "NEW HOLLAND", "NISSAN", "PERKINS / MAXION / INTERNATIONAL",
  "PEUGEOT", "RENAULT", "SCANIA", "SUZUKI", "TOYOTA", "TROLLER", "VALTRA / VALMET", "VOLARE",
  "VOLKSWAGEN", "VOLVO"
];

const HARDCODED_GRUPOS = [
  "JOGOS DE JUNTAS", "JUNTA DO CARTER", "JUNTA DO COLETOR DE ADMISSÃO",
  "JUNTA DO COLETOR DE ADMISSÃO E ESCAPAMENTO", "JUNTA DO COLETOR DE ESCAPAMENTO",
  "JUNTAS DE CABEÇOTE", "JUNTAS DIVERSAS", "RETENTORES", "TAMPA DE VÁLVULA", "TAMPA FRONTAL"
];

// Vehicle options (display label + canonical value)
const VEHICLE_OPTIONS = [
  { label: "Moto Leve", value: "MLL" },
  { label: "Motor Pesado", value: "MLP" },
  { label: "Veículo Linha leve", value: "VLL" },
  { label: "Veículo Linha pesada", value: "VLP" }
];

// Aliases to match aplicacoes.sigla_tipo / tipo / labels more flexibly
const VEHICLE_ALIASES = {
  MLL: ["MLL", "MOTO LEVE", "MOTO", "MOTOR LINHA LEVE", "MOTOR LEVE", "ML"],
  MLP: ["MLP", "MOTOR PESADO", "MOTOR LINHA PESADA", "MP"],
  VLL: ["VLL", "VEICULO LINHA LEVE", "VEÍCULO LINHA LEVE", "VEICULO LEVE", "VEÍCULO LEVE", "VEÍCULO - LINHA LEVE", "VEICULO - LINHA LEVE"],
  VLP: ["VLP", "VEICULO LINHA PESADA", "VEÍCULO LINHA PESADA", "VEICULO PESADO", "VEÍCULO PESADO", "VEÍCULO - LINHA PESADA"]
};

const PAGE_LIMIT = 50;

function normalizeString(v) {
  if (v === null || v === undefined) return "";
  return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesVehicleAlias(appValue, targetSigla) {
  if (!appValue || !targetSigla) return false;
  const normApp = String(appValue).toUpperCase().trim();
  const aliases = VEHICLE_ALIASES[targetSigla] || [];
  return aliases.some(a => a === normApp || normApp.includes(a));
}

function valueToSigla(value) {
  if (!value) return "";
  const up = String(value).trim().toUpperCase();
  const canonical = ["MLL", "MLP", "VLL", "VLP"];
  if (canonical.includes(up)) return up;
  const found = VEHICLE_OPTIONS.find(o => o.label.toUpperCase() === up);
  if (found) return found.value;
  for (const sigla of Object.keys(VEHICLE_ALIASES)) {
    const aliases = VEHICLE_ALIASES[sigla];
    if (aliases.some(a => a === up || up.includes(a))) return sigla;
  }
  return up;
}

function siglaToLabel(sigla) {
  if (!sigla) return "";
  const found = VEHICLE_OPTIONS.find(o => o.value === sigla);
  return found ? found.label : sigla;
}

function normalizeCodeForRoute(code) {
  if (!code) return "";
  return String(code).replace(/\s+/g, "").toUpperCase().trim();
}

function CatalogPage() {
  const { catalogState, updateCatalogState, preloadState, addToProductsCache } = useCatalogState();
  const { clearHistory: clearHistoryOnLogout, pushState: navigateTo } = useNavigationHistory();
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(true);

  // snapshot + UI state
  const [catalogSnapshot, setCatalogSnapshot] = useState(() => (preloadState && preloadState.snapshot) ? preloadState.snapshot : null);
  const [snapshotLoading, setSnapshotLoading] = useState(() => !(preloadState && preloadState.loaded && preloadState.snapshot));
  const [snapshotError, setSnapshotError] = useState(null);

  const [products, setProducts] = useState(() => {
    if (preloadState && preloadState.loaded && preloadState.snapshot) {
      const snap = preloadState.snapshot;
      const items = Array.isArray(snap.conjuntos) ? snap.conjuntos.slice(0, PAGE_LIMIT) : [];
      return items.map(it => ({
        codigo: String(it.codigo || it.pai || it.id || '').trim(),
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
      const total = Array.isArray(snap.conjuntos) ? snap.conjuntos.length : 0;
      return { page: 1, limit: PAGE_LIMIT, total, totalPages: Math.max(1, Math.ceil(total / PAGE_LIMIT)) };
    }
    return { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 };
  });

  const [availableFilters, setAvailableFilters] = useState(() => {
    const baseFilters = {
      grupos: HARDCODED_GRUPOS,
      subgrupos: [],
      fabricantes: HARDCODED_FABRICANTES.map(f => ({ name: f, count: 0 })),
      vehicleTypes: VEHICLE_OPTIONS.map(v => v.label) // labels for display only
    };
    if (preloadState && preloadState.availableFilters) {
      return {
        ...baseFilters,
        ...preloadState.availableFilters,
        grupos: HARDCODED_GRUPOS,
        fabricantes: HARDCODED_FABRICANTES.map(f => ({ name: f, count: 0 }))
      };
    }
    return baseFilters;
  });

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [loading, setLoading] = useState(() => !(preloadState && preloadState.loaded && preloadState.snapshot));
  const [error, setError] = useState("");
  const [imageErrors, setImageErrors] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(true);

  // Capture unhandled promise rejections to prevent noisy "Uncaught (in promise)" from bubbling to console
  useEffect(() => {
    const handler = (ev) => {
      // Prevent default so Chrome doesn't show Uncaught (in promise) in console
      try {
        // ignore expected extension/service worker noise, but keep a controlled log
        console.warn('Unhandled promise rejection (suppressed):', ev.reason);
        ev.preventDefault && ev.preventDefault();
      } catch (e) {
        // nothing
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  // lazy load images
  const { visibleItems: visibleImages, observeElement } = useLazyLoad({
    onVisible: (productCode) => {
      const currentIndex = products.findIndex(p => getProductCode(p) === productCode);
      if (currentIndex !== -1) {
        const preloadCount = 2;
        for (let i = 1; i <= preloadCount; i++) {
          const next = products[currentIndex + i];
          if (next) {
            const nextCode = getProductCode(next);
            if (nextCode && !visibleImages.has(nextCode)) {
              try { const img = new Image(); img.src = getImageUrl(nextCode); } catch (e) { /* ignore */ }
            }
          }
        }
      }
    }
  });

  const searchDebounceRef = useRef(null);

  const getProductCode = useCallback((product) => {
    if (!product) return "";
    return (product.codigo || product.code || product.id || "").toString().trim();
  }, []);

  const getProductDescription = useCallback((product) => {
    if (!product) return "Sem descrição disponível";
    return product.descricao || product.desc || product.nome || product.description || product.name || "Sem descrição disponível";
  }, []);

  const getProductGroup = useCallback((product) => {
    if (!product) return "";
    return product.grupo || product.category || product.group || "Sem grupo";
  }, []);

  const getImageUrl = useCallback((codigo) => {
    if (!codigo) return null; // return null to avoid src="" warnings
    return `/vista/${encodeURIComponent(codigo)}.jpg`;
  }, []);

  const totalItems = useMemo(() => (pagination.total || 0).toLocaleString(), [pagination.total]);

  // snapshot helpers
  const isSnapshotValid = useCallback(() => {
    return !!catalogSnapshot;
  }, [catalogSnapshot]);

  async function ensureSnapshot(force = false) {
    if (!force && catalogSnapshot && isSnapshotValid()) return catalogSnapshot;
    setSnapshotLoading(true);
    setSnapshotError(null);
    try {
      const snap = await fetchCatalogSnapshot(force);
      if (!snap || typeof snap !== "object") throw new Error("Snapshot inválido");
      if (!mountedRef.current) return snap;
      setCatalogSnapshot(snap);
      setSnapshotLoading(false);
      return snap;
    } catch (err) {
      if (mountedRef.current) {
        setSnapshotError(err?.message || String(err));
        setSnapshotLoading(false);
      }
      throw err;
    }
  }

  // build items from snapshot (dedupe: conjunto priority)
  function buildCatalogItemsFromSnapshot(snap) {
    const productsArr = Array.isArray(snap.products) ? snap.products : [];
    const conjuntosArr = Array.isArray(snap.conjuntos) ? snap.conjuntos : [];
    const aplicacoesArr = Array.isArray(snap.aplicacoes) ? snap.aplicacoes : [];

    const conjuntoChildrenMap = new Map();
    for (const row of conjuntosArr) {
      try {
        const pai = (row.pai || row.codigo_conjunto || row.codigo || "").toString().trim();
        const filho = (row.filho || row.codigo_componente || "").toString().trim();
        if (!pai || !filho) continue;
        if (!conjuntoChildrenMap.has(pai)) conjuntoChildrenMap.set(pai, []);
        conjuntoChildrenMap.get(pai).push(filho);
      } catch (e) { /* ignore */ }
    }

    const appByConjunto = new Map();
    for (const a of aplicacoesArr) {
      try {
        const cc = (a.codigo_conjunto || "").toString().trim();
        if (!cc) continue;
        if (!appByConjunto.has(cc)) appByConjunto.set(cc, []);
        appByConjunto.get(cc).push(a);
      } catch (e) { /* ignore */ }
    }

    const itemsMap = new Map();

    // add conjuntos first
    for (const [pai, filhos] of conjuntoChildrenMap.entries()) {
      try {
        const prodInfo = productsArr.find(p => ((p.codigo_abr || p.codigo || "").toString().trim() === pai)) || {};
        const aplics = appByConjunto.get(pai) || [];
        const fabricante = aplics.length ? (aplics[0].fabricante || "") : (prodInfo.fabricante || "");
        const tipoVeiculo = aplics.length ? (aplics[0].sigla_tipo || aplics[0].tipo || "") : (prodInfo.tipo || "");
        const item = {
          codigo: pai,
          descricao: prodInfo.descricao || prodInfo.nome || pai,
          grupo: prodInfo.grupo || null,
          tipo: "conjunto",
          fabricante,
          tipoVeiculo,
          conjuntosChildren: filhos
        };
        itemsMap.set(pai, item);
      } catch (e) { /* ignore */ }
    }

    // add products if not already present as conjunto
    for (const p of productsArr) {
      try {
        const codigo = (p.codigo_abr || p.codigo || "").toString().trim();
        if (!codigo) continue;
        if (itemsMap.has(codigo)) continue;
        const item = {
          codigo,
          descricao: p.descricao || p.nome || codigo,
          grupo: p.grupo || null,
          tipo: "produto",
          fabricante: p.fabricante || p.origem || "",
          tipoVeiculo: p.sigla_tipo || p.tipo || ""
        };
        itemsMap.set(codigo, item);
      } catch (e) { /* ignore */ }
    }

    return { items: Array.from(itemsMap.values()), conjuntoChildrenMap, appByConjunto };
  }

  // filter + paginate in-memory (robust)
  function filterAndPaginateItems(allItems, conjuntoChildrenMap, appByConjunto, filters, page = 1, limit = PAGE_LIMIT) {
    const search = normalizeString(filters.search || "");
    const grupoFilter = (filters.grupo || "").toString().trim().toLowerCase();
    const fabricanteFilter = (filters.fabricante || "").toString().trim().toLowerCase();
    const tipoVeiculoFilter = valueToSigla(filters.tipoVeiculo || "").toString().trim().toUpperCase();
    const sortBy = filters.sortBy || "codigo";
    const isConjunto = (filters.isConjunto === true) ? "conjunto" : ((filters.isConjunto === false) ? "produto" : null);

    let matchingCodesForFabricante = null;
    if (fabricanteFilter || tipoVeiculoFilter) {
      matchingCodesForFabricante = new Set();
      for (const [codigo_conjunto, apps] of appByConjunto.entries()) {
        try {
          const matchesFabricante = fabricanteFilter ? apps.some(a => normalizeString(a.fabricante || "").includes(fabricanteFilter)) : true;
          const matchesTipo = tipoVeiculoFilter ? apps.some(a => {
            const at = (a.sigla_tipo || a.tipo || "").toString().trim();
            if (!at) return false;
            if (String(at).toUpperCase() === tipoVeiculoFilter) return true;
            return matchesVehicleAlias(at, tipoVeiculoFilter);
          }) : true;
          if (matchesFabricante && matchesTipo) {
            matchingCodesForFabricante.add(codigo_conjunto);
            const filhos = conjuntoChildrenMap.get(codigo_conjunto) || [];
            for (const f of filhos) matchingCodesForFabricante.add(f);
          }
        } catch (e) { /* ignore */ }
      }
    }

    const filtered = allItems.filter(it => {
      try {
        if (isConjunto && it.tipo !== isConjunto) return false;

        // Check fabricante/tipoVeiculo filters for conjuntos
        if (matchingCodesForFabricante && !matchingCodesForFabricante.has(it.codigo)) {
          // For individual products, also check if they match tipoVeiculo directly
          if (it.tipo === "produto" && tipoVeiculoFilter) {
            const itemTipo = (it.tipoVeiculo || "").toString().trim().toUpperCase();
            if (itemTipo === tipoVeiculoFilter || matchesVehicleAlias(itemTipo, tipoVeiculoFilter)) {
              // Product matches tipoVeiculo directly, allow it
            } else {
              return false;
            }
          } else {
            return false;
          }
        }

        if (grupoFilter) {
          const g = (it.grupo || "").toString().trim().toLowerCase();
          if (g !== grupoFilter) return false;
        }
        if (search) {
          const c = normalizeString(it.codigo || "");
          const d = normalizeString(it.descricao || "");
          if (!c.includes(search) && !d.includes(search)) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    });

    filtered.sort((a, b) => {
      try {
        if (sortBy === "descricao") return String(a.descricao || "").localeCompare(String(b.descricao || ""));
        if (sortBy === "grupo") return String(a.grupo || "").localeCompare(String(b.grupo || ""));
        return String(a.codigo || "").localeCompare(String(b.codigo || ""));
      } catch (e) { return 0; }
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const offset = (safePage - 1) * limit;
    const pageItems = filtered.slice(offset, offset + limit);

    return { items: pageItems, pagination: { page: safePage, limit, total, totalPages } };
  }

  // loadProducts: prefer snapshot, fallback to server; fixed combined-server paging
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
        sortBy: catalogState?.currentFilters?.sortBy || "codigo",
        isConjunto: catalogState?.currentFilters?.isConjunto
      };

      // try snapshot
      try {
        const snap = await ensureSnapshot(false);
        if (snap) {
          const { items: allItems, conjuntoChildrenMap, appByConjunto } = buildCatalogItemsFromSnapshot(snap);
          const { items: pageItems, pagination: pg } = filterAndPaginateItems(allItems, conjuntoChildrenMap, appByConjunto, filters, page, PAGE_LIMIT);
          if (!mountedRef.current) return;
          setProducts(pageItems);
          setPagination(pg);
          setImageErrors({});
          if (pageItems.length > 0 && typeof addToProductsCache === "function") addToProductsCache(pageItems);
          setLoading(false);
          return;
        }
      } catch (snapErr) {
        console.warn("snapshot fallback:", snapErr?.message || snapErr);
      }

      // fallback: server paginated endpoints
      let resp = null;
      if (filters.isConjunto === true) {
        resp = await fetchConjuntosPaginated(page, PAGE_LIMIT, filters);
      } else if (filters.isConjunto === false) {
        resp = await fetchProductsPaginated(page, PAGE_LIMIT, filters);
      } else {
        // Combined fallback: request same page number to both endpoints (fixed)
        const [conjResp, prodResp] = await Promise.all([
          fetchConjuntosPaginated(page, Math.ceil(PAGE_LIMIT / 2), filters),
          fetchProductsPaginated(page, Math.floor(PAGE_LIMIT / 2), filters)
        ]);

        const conjItems = (Array.isArray(conjResp.data) ? conjResp.data : []).map(it => ({
          codigo: String(it.pai || it.codigo || it.id || '').trim(),
          descricao: String(it.descricao || it.desc || it.nome || '').trim(),
          grupo: String(it.grupo || '').trim(),
          tipo: "conjunto",
          fabricante: it.fabricante || it.marca || '',
          tipoVeiculo: it.tipoVeiculo || ''
        })).filter(it => it.codigo && it.descricao);

        const prodItems = (Array.isArray(prodResp.data) ? prodResp.data : []).map(it => ({
          codigo: String(it.codigo_abr || it.codigo || it.id || '').trim(),
          descricao: String(it.descricao || it.desc || it.nome || '').trim(),
          grupo: String(it.grupo || '').trim(),
          tipo: "produto",
          fabricante: it.fabricante || it.marca || '',
          tipoVeiculo: it.tipoVeiculo || ''
        })).filter(it => it.codigo && it.descricao);

        // merge with conjuntos priority
        const merged = new Map();
        for (const c of conjItems) merged.set(c.codigo, { ...c, tipo: 'conjunto' });
        for (const p of prodItems) if (!merged.has(p.codigo)) merged.set(p.codigo, { ...p, tipo: 'produto' });

        const items = Array.from(merged.values());
        const totalConj = conjResp.pagination?.total || conjItems.length;
        const totalProd = prodResp.pagination?.total || prodItems.length;
        const total = totalConj + totalProd;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
        if (!mountedRef.current) return;
        setProducts(items);
        setPagination({ page, limit: PAGE_LIMIT, total, totalPages });
        setLoading(false);
        return;
      }

      // single-type server response
      if (resp && resp.data) {
        const items = (Array.isArray(resp.data) ? resp.data : []).map(it => {
          if (it.pai || it.codigo) {
            return {
              codigo: String(it.pai || it.codigo || '').trim(),
              descricao: String(it.descricao || it.nome || '').trim(),
              grupo: it.grupo || '',
              tipo: 'conjunto',
              fabricante: it.fabricante || ''
            };
          }
          return {
            codigo: String(it.codigo_abr || it.codigo || '').trim(),
            descricao: String(it.descricao || it.nome || '').trim(),
            grupo: it.grupo || '',
            tipo: 'produto',
            fabricante: it.fabricante || ''
          };
        }).filter(it => it.codigo && it.descricao);

        // dedupe by codigo
        const deduped = [];
        const seen = new Set();
        for (const it of items) {
          if (!seen.has(it.codigo)) {
            deduped.push(it);
            seen.add(it.codigo);
          }
        }

        const total = resp.pagination?.total || deduped.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
        if (!mountedRef.current) return;
        setProducts(deduped);
        setPagination({ page: resp.pagination?.page || page, limit: PAGE_LIMIT, total, totalPages });
      } else {
        if (!mountedRef.current) return;
        setProducts([]);
        setPagination({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
      }
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

  // effects
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        if (!catalogSnapshot) {
          await ensureSnapshot(false).catch(() => {/* ignore */ });
        }
      } finally {
        loadProducts(catalogState.currentPage || 1);
      }
    })();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      loadProducts(catalogState.currentPage || 1);
    }, 220);
    return () => {
      if (searchDebounceRef.current) { clearTimeout(searchDebounceRef.current); searchDebounceRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogState.currentFilters, catalogState.currentPage]);

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

  useEffect(() => {
    if (!products || !products.length) return;
    const timeoutId = setTimeout(() => {
      const imageElements = document.querySelectorAll('[data-lazy-id]');
      const batchSize = 10;
      let processed = 0;
      const processBatch = () => {
        const batch = Array.from(imageElements).slice(processed, processed + batchSize);
        batch.forEach(img => observeElement(img));
        processed += batchSize;
        if (processed < imageElements.length) setTimeout(processBatch, 0);
      };
      processBatch();
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [products, observeElement]);

  // parse query params on mount (ensure tipoVeiculo becomes sigla)
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const page = parseInt(qs.get("page")) || catalogState.currentPage || 1;
    const search = qs.get("search") || catalogState.currentFilters?.search || "";
    const grupo = qs.get("grupo") || catalogState.currentFilters?.grupo || "";
    const fabricante = qs.get("fabricante") || catalogState.currentFilters?.fabricante || "";
    const tipoVeiculoQs = qs.get("tipoVeiculo") || catalogState.currentFilters?.tipoVeiculo || "";
    const tipoVeiculo = valueToSigla(tipoVeiculoQs);
    const sortBy = qs.get("sortBy") || catalogState.currentFilters?.sortBy || "codigo";

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
    if (f.sortBy) params.set("sortBy", f.sortBy);
    const query = params.toString();
    const newUrl = query ? `${location.pathname}?${query}` : location.pathname;
    navigate(newUrl, { replace: true });
  }, [catalogState.currentFilters, catalogState.currentPage, navigate, location.pathname]);

  // active filters computation (count + list)
  const activeFilters = useMemo(() => {
    const f = catalogState.currentFilters || {};
    const entries = [];
    if (f.search) entries.push({ key: "search", label: f.search });
    if (f.grupo) entries.push({ key: "grupo", label: f.grupo });
    if (f.fabricante) entries.push({ key: "fabricante", label: f.fabricante });
    if (f.tipoVeiculo) entries.push({ key: "tipoVeiculo", label: siglaToLabel(valueToSigla(f.tipoVeiculo)) });
    return entries;
  }, [catalogState.currentFilters]);

  const activeFiltersCount = activeFilters.length;

  // handlers
  const handleFilterChange = (key, value) => {
    let normalized = (typeof value === 'string') ? value : (value === null || value === undefined ? "" : String(value));
    if (key === "tipoVeiculo") {
      normalized = valueToSigla(normalized);
    }
    const nextFilters = { ...catalogState.currentFilters, [key]: normalized };
    updateCatalogState({ currentFilters: nextFilters, currentPage: 1 });
  };

  const handleRemoveFilter = (key) => {
    const nextFilters = { ...catalogState.currentFilters, [key]: "" };
    updateCatalogState({ currentFilters: nextFilters, currentPage: 1 });
  };

  const handleResetFilters = () => {
    updateCatalogState({
      currentFilters: { search: "", grupo: "", tipo: "", fabricante: "", tipoVeiculo: "", sortBy: "codigo" },
      currentPage: 1
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

    // Use react-router navigate with state so product page can read from location.state first (faster)
    navigate(productUrl, { state: { fromCatalog: true, catalogState: { page: catalogState.currentPage, filters: catalogState.currentFilters } } });

    // If you still want to use your custom navigation history helper, call it async to avoid message-channel problems
    if (typeof navigateTo === "function") {
      setTimeout(() => {
        try {
          navigateTo(productUrl, {
            fromCatalog: true,
            catalogState: { page: catalogState.currentPage, filters: catalogState.currentFilters }
          });
        } catch (e) {
          // ignore errors from custom history helper
        }
      }, 0);
    }
  };

  const handleImageError = useCallback((codigo) => {
    setImageErrors(prev => ({ ...prev, [codigo]: true }));
  }, []);

  const handleScrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), []);

  // render
  return (
    <div className="catalog-wrapper">
      <Header onLogoClick={clearHistoryOnLogout}>
        <div className="stats-badge">
          <span className="stats-number">{totalItems}</span>
          <span className="stats-label">itens</span>
        </div>

        <button className="header-filter-btn" onClick={() => setFilterModalOpen(true)} aria-label="Abrir filtros">
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
          <aside className="catalog-filters">
            <div className="filters-header">
              <h2 className="filters-title">Filtros</h2>
              {activeFiltersCount > 0 ? (
                <button className="clear-filters-btn" onClick={handleResetFilters}>Limpar</button>
              ) : null}
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
                  {HARDCODED_GRUPOS.map(gr => <option key={gr} value={gr}>{gr}</option>)}
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
                  {HARDCODED_FABRICANTES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Tipo de veículo</label>
                <select
                  /* IMPORTANT: use the raw value saved in state (already canonicalized by handler) */
                  value={catalogState.currentFilters.tipoVeiculo || ""}
                  onChange={(e) => handleFilterChange("tipoVeiculo", e.target.value)}
                  className="filter-select"
                  disabled={!filtersLoaded}
                >
                  <option value="">{filtersLoaded ? "Todos os tipos" : "Carregando..."}</option>
                  {VEHICLE_OPTIONS.map(opt => (
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
                    {activeFilters.map(f => (
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
                {pagination.totalPages > 1 && <span className="results-pages">Página {catalogState.currentPage} de {pagination.totalPages}</span>}
              </div>
            </div>

            {loading && <div className="loading-state"><LoadingSpinner /><p>Carregando produtos...</p></div>}

            {error && !loading && <div className="error-state"><ErrorMessage error={error} onRetry={() => loadProducts(catalogState.currentPage)} /></div>}

            {!loading && !error && products.length === 0 && <EmptyState message="Nenhum produto encontrado" onAction={handleResetFilters} actionLabel="Limpar filtros" />}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="products-grid">
                  {products.map((product) => {
                    const productCode = getProductCode(product);
                    const productDescription = getProductDescription(product);
                    const productGroup = getProductGroup(product);
                    const key = `${product.tipo || 'p'}-${productCode}`;
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

      <FilterModal
        isOpen={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        currentFilters={catalogState.currentFilters}
        onFilterChange={handleFilterChange}
        availableFilters={availableFilters}
        onResetFilters={handleResetFilters}
      />

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

// Memoized Product Card Component
const ProductCard = React.memo(({
  product,
  productCode,
  productDescription,
  productGroup,
  visibleImages,
  imageErrors,
  getImageUrl,
  onImageError,
  onProductClick,
  observeElement
}) => {
  useEffect(() => {
    try {
      const imgElement = document.querySelector(`[data-lazy-id="${productCode}"]`);
      if (imgElement) observeElement(imgElement);
    } catch (e) {
      // defensive: ignore DOM errors
    }
  }, [productCode, observeElement]);

  // ensure we don't pass empty string to src (caused warning). Use null to omit attribute.
  const src = visibleImages.has(productCode) ? getImageUrl(productCode) : null;

  return (
    <div
      className="product-card"
      onClick={() => onProductClick(productCode)}
    >
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
            onProductClick(productCode);
          }}
        >
          Ver detalhes
        </button>
      </div>
    </div>
  );
});
