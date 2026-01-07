// Import utilities from the shared vehicle utils module. This allows us to
// canonicalize vehicle type values (siglas) and match aliases consistently.
import {
  valueToSigla,
  matchesVehicleAlias,
  normalizeString,
} from "../utils/vehicleUtils";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

// Timeout padrão para requisições (ms)
const REQUEST_TIMEOUT = 15000;

// Sanitização e validação de entrada
function sanitizeString(str, maxLength = 100) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>\"'&]/g, '').trim().substring(0, maxLength);
}

function validatePaginationParams(page, limit) {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  return {
    page: isNaN(pageNum) || pageNum < 1 ? 1 : Math.min(pageNum, 1000),
    limit: isNaN(limitNum) || limitNum < 1 ? 20 : Math.min(limitNum, 100)
  };
}

function validateFilters(filters) {
  return {
    search: sanitizeString(filters.search, 100),
    grupo: sanitizeString(filters.grupo, 50),
    fabricante: sanitizeString(filters.fabricante, 50),
    tipoVeiculo: sanitizeString(filters.tipoVeiculo, 50),
    numero_original: sanitizeString(filters.numero_original, 50),
    sortBy: ['codigo', 'nome', 'fabricante', 'grupo'].includes(filters.sortBy) ? filters.sortBy : 'codigo'
  };
}

function validateProductCode(code) {
  const normalized = normalizeCodeFront(code);
  return normalized.length > 0 && normalized.length <= 50 ? normalized : null;
}

// Cache simples em memória com validação
const cache = {
  products: null,
  conjuntos: null,
  filters: null,
  status: null,
  timestamp: 0,
  // snapshot-specific
  catalog: null,
  catalogTimestamp: 0,
};

const CACHE_DURATION = Number(
  process.env.REACT_APP_CATALOG_TTL_MS || 60 * 60 * 1000
); // 1 hora por padrão

function isCacheValid() {
  return Date.now() - cache.timestamp < CACHE_DURATION;
}
function isCatalogCacheValid() {
  return Date.now() - cache.catalogTimestamp < CACHE_DURATION;
}
function invalidateCache() {
  cache.products = null;
  cache.conjuntos = null;
  cache.filters = null;
  cache.status = null;
  cache.timestamp = 0;
}
function invalidateCatalog() {
  cache.catalog = null;
  cache.catalogTimestamp = 0;
}

// normalização de código (consistente)
function normalizeCodeFront(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase().trim();
}

// ====== FUNÇÕES DE UTILIDADE ======
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Requisição expirou (timeout ${REQUEST_TIMEOUT}ms)`);
    }
    throw error;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (
        (response.status === 503 || response.status === 504) &&
        attempt < maxRetries
      ) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError;
}

async function handleResponse(response) {
  if (!response) throw new Error("Resposta do servidor inválida");

  let body = {};
  try {
    // alguns endpoints retornam 204 No Content -> response.json() falha
    if (response.status === 204) return null;
    body = await response.json();
  } catch (e) {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${text.substring(0, 200)}`);
    }
    return null;
  }

  if (!response.ok) {
    throw new Error(body.error || `Erro HTTP ${response.status}`);
  }

  if (typeof body !== "object" || body === null) {
    throw new Error("Resposta do servidor não é um objeto JSON válido");
  }

  return body;
}

function validateParams(params) {
  const { page = 1, limit = 20 } = params;
  const { page: validPage, limit: validLimit } = validatePaginationParams(page, limit);
  return { page: validPage, limit: validLimit };
}

// ====== Snapshot (catalog) helpers ======
export async function fetchCatalogSnapshot(force = false) {
  // Usa cache local se válido, a menos que force === true
  if (!force && cache.catalog && isCatalogCacheValid()) {
    return cache.catalog;
  }

  const url = `${API_BASE_URL}/catalog` + (force ? "?reload=1" : "");
  const resp = await fetchWithRetry(url, undefined, 2);
  const body = await handleResponse(resp);

  // body expected shape: { data: { products:[], conjuntos:[], aplicacoes:[], fabricantes:[] }, ...}
  if (!body || !body.data) {
    throw new Error("Resposta inválida ao buscar snapshot do catálogo");
  }

  cache.catalog = body.data;
  cache.catalogTimestamp = Date.now();
  return cache.catalog;
}

export function getCachedCatalog() {
  return cache.catalog;
}

// Filtragem/ordenacao/paginacao eficiente em memória baseada no snapshot.
// Mantém a semântica dos filtros que você já usa no frontend. Vehicle type
// handling has been unified with alias support.
export function filterCatalogSnapshot(
  snapshot,
  filters = {},
  page = 1,
  limit = 20
) {
  if (!snapshot || typeof snapshot !== "object") {
    return {
      data: [],
      pagination: { page: 1, limit, total: 0, totalPages: 0 },
    };
  }

  const productsArr = Array.isArray(snapshot.products)
    ? snapshot.products
    : [];
  const conjuntosArr = Array.isArray(snapshot.conjuntos)
    ? snapshot.conjuntos
    : [];
  const aplicacoesArr = Array.isArray(snapshot.aplicacoes)
    ? snapshot.aplicacoes
    : [];

  // Build maps to accelerate fabricante/tipoVeiculo lookups
  const conjuntoChildrenMap = new Map();
  for (const row of conjuntosArr) {
    const pai = (row.pai || row.codigo_conjunto || "").toString().trim();
    const filho = (row.filho || row.codigo_componente || "").toString().trim();
    if (!pai || !filho) continue;
    if (!conjuntoChildrenMap.has(pai)) conjuntoChildrenMap.set(pai, []);
    conjuntoChildrenMap.get(pai).push(filho);
  }

  const appByConjunto = new Map();
  for (const a of aplicacoesArr) {
    const cc = (a.codigo_conjunto || "").toString().trim();
    if (!cc) continue;
    if (!appByConjunto.has(cc)) appByConjunto.set(cc, []);
    appByConjunto.get(cc).push(a);
  }

  // Build unified items list (preserve conjuntos as items with tipo 'conjunto' and products as 'produto')
  const items = [];
  // Add conjuntos (pai)
  for (const [pai, filhos] of conjuntoChildrenMap.entries()) {
    const prod =
      productsArr.find(
        (p) =>
          (p.codigo_abr || p.codigo || "").toString().trim() === pai
      ) || {};
    const apps = appByConjunto.get(pai) || [];
    const fabricante = apps.length
      ? apps[0].fabricante || ""
      : prod.fabricante || "";
    const tipoVeiculo = apps.length
      ? apps[0].sigla_tipo || apps[0].tipo || ""
      : prod.tipo || "";
    items.push({
      codigo: pai,
      descricao: prod.descricao || prod.nome || pai,
      grupo: prod.grupo || null,
      tipo: "conjunto",
      fabricante,
      tipoVeiculo,
      conjuntosChildren: filhos,
    });
  }
  // Add products not already represented as conjuntos
  for (const p of productsArr) {
    const codigo = (p.codigo_abr || p.codigo || "").toString().trim();
    if (!codigo) continue;
    const existsConjunto = items.some(
      (i) => i.codigo === codigo && i.tipo === "conjunto"
    );
    if (existsConjunto) continue;
    items.push({
      codigo,
      descricao: p.descricao || p.nome || codigo,
      grupo: p.grupo || null,
      tipo: "produto",
      fabricante: p.fabricante || p.origem || "",
      tipoVeiculo: p.sigla_tipo || p.tipo || "",
    });
  }

  // Apply filters
  const search = normalizeString(filters.search || "");
  const grupoFilter = (filters.grupo || "").toString().trim().toLowerCase();
  const fabricanteFilter = (filters.fabricante || "")
    .toString()
    .trim()
    .toLowerCase();
  const tipoVeiculoFilter = valueToSigla(filters.tipoVeiculo || "")
    .trim()
    .toUpperCase();
  const sortBy = filters.sortBy || "codigo";
  const isConjunto =
    filters.isConjunto === true
      ? "conjunto"
      : filters.isConjunto === false
        ? "produto"
        : null;

  // Precompute matching codes for fabricante/tipoVeiculo by scanning aplicacoes (fast with maps)
  let matchingCodesForFabricante = null;
  if (fabricanteFilter || tipoVeiculoFilter) {
    matchingCodesForFabricante = new Set();
    for (const [codigo_conjunto, apps] of appByConjunto.entries()) {
      const matchesFabricante = fabricanteFilter
        ? apps.some((a) =>
          normalizeString(a.fabricante || "").includes(fabricanteFilter)
        )
        : true;
      const matchesTipo = tipoVeiculoFilter
        ? apps.some((a) => {
          const raw = (a.sigla_tipo || a.tipo || "").toString().trim();
          if (!raw) return false;
          const sigla = valueToSigla(raw).toUpperCase();
          return (
            sigla === tipoVeiculoFilter ||
            matchesVehicleAlias(raw, tipoVeiculoFilter)
          );
        })
        : true;
      if (matchesFabricante && matchesTipo) {
        matchingCodesForFabricante.add(codigo_conjunto);
        const filhos = conjuntoChildrenMap.get(codigo_conjunto) || [];
        filhos.forEach((f) => matchingCodesForFabricante.add(f));
      }
    }
  }

  const filtered = items.filter((it) => {
    // Filter by type (conjunto/produto)
    if (isConjunto && it.tipo !== isConjunto) return false;

    // Filter by fabricante/tipoVeiculo using the precomputed matching set.
    if (matchingCodesForFabricante && !matchingCodesForFabricante.has(it.codigo)) {
      if (it.tipo === "produto" && tipoVeiculoFilter) {
        const raw = (it.tipoVeiculo || "").toString().trim();
        if (!raw) return false;
        const sigla = valueToSigla(raw).toUpperCase();
        if (
          sigla === tipoVeiculoFilter ||
          matchesVehicleAlias(raw, tipoVeiculoFilter)
        ) {
          // allow
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    // Filter by group
    if (grupoFilter) {
      const g = (it.grupo || "").toString().trim().toLowerCase();
      if (g !== grupoFilter) return false;
    }

    // Filter by search term (code or description)
    if (search) {
      const c = normalizeString(it.codigo || "");
      const d = normalizeString(it.descricao || "");
      if (!c.includes(search) && !d.includes(search)) return false;
    }
    return true;
  });

  // Ordena
  filtered.sort((a, b) => {
    if (sortBy === "descricao")
      return String(a.descricao || "").localeCompare(String(b.descricao || ""));
    if (sortBy === "grupo")
      return String(a.grupo || "").localeCompare(String(b.grupo || ""));
    return String(a.codigo || "").localeCompare(String(b.codigo || ""));
  });

  // Pagina
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (safePage - 1) * limit;
  const pageItems = filtered.slice(offset, offset + limit);

  // Return shape compatible with CatalogPage usage
  return {
    data: pageItems,
    pagination: { page: safePage, limit, total, totalPages },
  };
}

// ====== FUNÇÕES DE REQUISIÇÃO PRINCIPAIS (compatíveis com sua API atual) ======
export async function fetchProducts(search = "") {
  try {
    const url = new URL(`${API_BASE_URL}/products`);
    if (search && typeof search === "string")
      url.searchParams.set("search", search.trim().substring(0, 100));
    const response = await fetchWithRetry(url.toString());
    const data = await handleResponse(response);
    if (!Array.isArray(data)) {
      return [];
    }
    return data;
  } catch (error) {
    throw new Error(`Falha ao carregar produtos: ${error.message}`);
  }
}

export async function fetchProductsPaginated(page = 1, limit = 20, filters = {}) {
  // validação e sanitização
  const { page: validPage, limit: validLimit } = validatePaginationParams(page, limit);
  const validFilters = validateFilters(filters);

  // se snapshot válido e disponível, use filtro client-side (muito mais rápido)
  if (cache.catalog && isCatalogCacheValid()) {
    try {
      const result = filterCatalogSnapshot(cache.catalog, validFilters, validPage, validLimit);
      return { data: result.data, pagination: result.pagination };
    } catch (e) {
      // se der erro, fallback para API
      console.warn(
        "fetchProductsPaginated: fallback para API (erro no filtro local):",
        e.message || e
      );
    }
  }

  // fallback: requisição paginada ao backend
  const url = new URL(`${API_BASE_URL}/products/paginated-optimized`);
  url.searchParams.set("page", String(validPage));
  url.searchParams.set("limit", String(validLimit));

  if (validFilters.search) url.searchParams.set("search", validFilters.search);
  if (validFilters.grupo) url.searchParams.set("grupo", validFilters.grupo);
  if (validFilters.fabricante) url.searchParams.set("fabricante", validFilters.fabricante);
  if (validFilters.tipoVeiculo) url.searchParams.set("tipoVeiculo", validFilters.tipoVeiculo);
  if (validFilters.numero_original) url.searchParams.set("numero_original", validFilters.numero_original);
  if (validFilters.sortBy) url.searchParams.set("sortBy", validFilters.sortBy);

  const response = await fetchWithRetry(url.toString());
  const body = await handleResponse(response);
  if (!body || typeof body !== "object") {
    throw new Error("Estrutura de resposta inválida");
  }

  return {
    data: Array.isArray(body.data) ? body.data : [],
    pagination: {
      page: parseInt(body.pagination?.page) || validPage,
      limit: parseInt(body.pagination?.limit) || validLimit,
      total: parseInt(body.pagination?.total) || 0,
      totalPages:
        parseInt(body.pagination?.totalPages) ||
        Math.max(
          1,
          Math.ceil((parseInt(body.pagination?.total) || 0) / validLimit)
        ),
    },
  };
}

export async function fetchConjuntosPaginated(
  page = 1,
  limit = 20,
  filters = {}
) {
  const { page: validPage, limit: validLimit } = validateParams({
    page,
    limit,
  });

  // preferir snapshot se disponível
  if (cache.catalog && isCatalogCacheValid()) {
    try {
      // forçar isConjunto = true
      const localFilters = { ...filters, isConjunto: true };
      const result = filterCatalogSnapshot(
        cache.catalog,
        localFilters,
        validPage,
        validLimit
      );
      return { data: result.data, pagination: result.pagination };
    } catch (e) {
      console.warn(
        "fetchConjuntosPaginated: fallback para API (erro no filtro local):",
        e.message || e
      );
    }
  }

  // fallback para API paginada
  const url = new URL(`${API_BASE_URL}/conjuntos/paginated`);
  url.searchParams.set("page", String(validPage));
  url.searchParams.set("limit", String(validLimit));
  if (filters.search)
    url.searchParams.set(
      "search",
      String(filters.search).trim().substring(0, 100)
    );
  if (filters.grupo)
    url.searchParams.set("grupo", String(filters.grupo).trim().substring(0, 50));
  if (filters.fabricante)
    url.searchParams.set(
      "fabricante",
      String(filters.fabricante).trim().substring(0, 50)
    );
  if (filters.tipoVeiculo)
    url.searchParams.set(
      "tipoVeiculo",
      String(filters.tipoVeiculo).trim().substring(0, 20)
    );
  if (filters.sortBy)
    url.searchParams.set(
      "sortBy",
      String(filters.sortBy).substring(0, 50)
    );

  const response = await fetchWithRetry(url.toString());
  const body = await handleResponse(response);
  if (!body || typeof body !== "object") {
    throw new Error("Estrutura de resposta inválida");
  }

  // Cache conjuntos para lookup rápido (mantemos comportamento antigo)
  cache.conjuntos = Array.isArray(body.data) ? body.data : [];
  cache.timestamp = Date.now();

  return {
    data: cache.conjuntos,
    pagination: {
      page: parseInt(body.pagination?.page) || validPage,
      limit: parseInt(body.pagination?.limit) || validLimit,
      total: parseInt(body.pagination?.total) || 0,
      totalPages:
        parseInt(body.pagination?.totalPages) ||
        Math.max(
          1,
          Math.ceil((parseInt(body.pagination?.total) || 0) / validLimit)
        ),
    },
  };
}

export async function fetchProductDetails(code) {
  const validCode = validateProductCode(code);
  if (!validCode) {
    throw new Error("Código do produto inválido");
  }

  try {
    const normalizedCode = normalizeCodeFront(validCode);

    // 1) tentativa rápida: buscar no snapshot em memória
    if (cache.catalog && isCatalogCacheValid()) {
      const snap = cache.catalog;
      // procura por código exato (procura em products e conjuntos)
      const byProducts = (Array.isArray(snap.products) ? snap.products : []).find(
        (p) =>
          (p.codigo_abr || p.codigo || "")
            .toString()
            .trim()
            .toUpperCase() === normalizedCode
      );
      if (byProducts) return byProducts;
      const byConjuntos = (Array.isArray(snap.conjuntos) ? snap.conjuntos : []).find(
        (c) =>
          (c.pai || c.codigo_conjunto || c.codigo || "")
            .toString()
            .trim()
            .toUpperCase() === normalizedCode
      );
      if (byConjuntos) return byConjuntos;
      // else continue to server
    }

    // 2) buscar no servidor (rota de detalhe)
    const url = `${API_BASE_URL}/products/${encodeURIComponent(
      normalizedCode
    )}`;
    const resp = await fetchWithRetry(url);
    // detectar respostas HTML
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const text = await resp.text();
      throw new Error(
        `Resposta inesperada (HTML). Conteúdo truncado: ${text
          .substring(0, 200)
          .replace(/\s+/g, " ")}`
      );
    }
    const body = await handleResponse(resp);
    return body;
  } catch (error) {
    // fallback: tentar buscar por search (mesma estratégia que você já havia implementado)
    try {
      const normalizedCode = normalizeCodeFront(code);
      const searchUrl = `${API_BASE_URL}/products?search=${encodeURIComponent(
        normalizedCode
      )}`;
      const searchResp = await fetchWithRetry(searchUrl);
      const searchData = await handleResponse(searchResp);
      if (Array.isArray(searchData) && searchData.length > 0)
        return searchData[0];
    } catch (e) {
      // ignora
    }
    throw new Error(
      `Falha ao carregar detalhes do produto: ${error?.message || error}`
    );
  }
}

export async function fetchFilters() {
  try {
    // Se snapshot tiver fabricantes/grupos, usamos direto
    if (cache.catalog && isCatalogCacheValid()) {
      const snap = cache.catalog;
      const grupos = Array.isArray(snap.grupos)
        ? snap.grupos
        : Array.isArray(snap.products)
          ? Array.from(
            new Set(
              (snap.products || [])
                .map((p) => p.grupo)
                .filter(Boolean)
            )
          ).sort()
          : [];
      const fabricantesRaw = Array.isArray(snap.fabricantes)
        ? snap.fabricantes
        : [];
      const fabricantes = fabricantesRaw
        .map((f) => {
          if (typeof f === "string") return { name: f, count: 0 };
          if (f && f.name)
            return { name: f.name, count: Number(f.count) || 0 };
          return null;
        })
        .filter(Boolean);
      const vehicleTypes = Array.isArray(snap.vehicle_types)
        ? snap.vehicle_types
        : Array.isArray(snap.aplicacoes)
          ? Array.from(
            new Set(
              (snap.aplicacoes || [])
                .map((a) => a.sigla_tipo)
                .filter(Boolean)
            )
          )
          : [];
      return { grupos, tipos: [], fabricantes, vehicleTypes };
    }

    const url = `${API_BASE_URL}/filters`;
    const response = await fetchWithRetry(url);
    const data = await handleResponse(response);
    if (!data || typeof data !== "object") {
      return { grupos: [], tipos: [], fabricantes: [], vehicleTypes: [] };
    }

    // Normalize fabricantes
    const fabricantesRaw = Array.isArray(data.fabricantes)
      ? data.fabricantes
      : [];
    const fabricantes = fabricantesRaw
      .map((f) => {
        if (typeof f === "string") return { name: f, count: 0 };
        if (f && f.name) return { name: f.name, count: Number(f.count) || 0 };
        return null;
      })
      .filter(Boolean);

    const vtRaw = Array.isArray(data.vehicle_types)
      ? data.vehicle_types
      : Array.isArray(data.vehicleTypes)
        ? data.vehicleTypes
        : Array.isArray(data.tipoVeiculo)
          ? data.tipoVeiculo
          : [];
    const canonical = new Set(["VLL", "VLP", "MLL", "MLP"]);
    const vtNormalized = Array.from(
      new Set(
        vtRaw
          .map((v) => String(v).trim().toUpperCase())
          .filter(Boolean)
      )
    ).filter((s) => canonical.has(s));

    return {
      grupos: Array.isArray(data.grupos) ? data.grupos : [],
      tipos: Array.isArray(data.tipos) ? data.tipos : [],
      fabricantes,
      vehicleTypes: vtNormalized.length
        ? vtNormalized
        : Array.from(canonical),
    };
  } catch (error) {
    return {
      grupos: [],
      tipos: [],
      fabricantes: [],
      vehicleTypes: ["Leve", "Pesado"],
    };
  }
}

export async function seedFabricantes() {
  try {
    const url = `${API_BASE_URL}/filters/seed-fabricantes`;
    const response = await fetchWithRetry(url, { method: "POST" }, 1);
    return response && (response.status === 204 || response.ok);
  } catch (error) {
    return false;
  }
}

export async function fetchCatalogStatus() {
  try {
    // se cache disponível, retorne algo sensato rapidamente
    if (cache.catalog && isCatalogCacheValid()) {
      const snap = cache.catalog;
      const totalProducts = Array.isArray(snap.products)
        ? snap.products.length
        : 0;
      const totalConjuntos = Array.isArray(snap.conjuntos)
        ? new Set(
          snap.conjuntos.map((c) => c.pai || c.codigo_conjunto)
        ).size
        : 0;
      return {
        totalProducts,
        totalConjuntos,
        lastUpdate: new Date(cache.catalogTimestamp).toISOString(),
      };
    }
    const url = `${API_BASE_URL}/status`;
    const response = await fetchWithRetry(url);
    const data = await handleResponse(response);
    return {
      totalProducts: parseInt(data.totalProducts) || 0,
      totalConjuntos: parseInt(data.totalConjuntos) || 0,
      lastUpdate: data.lastUpdate || null,
    };
  } catch (error) {
    return { totalProducts: 0, totalConjuntos: 0, lastUpdate: null };
  }
}

// Expõe utilitários de cache
export { invalidateCache as invalidateSimpleCache, invalidateCatalog };
