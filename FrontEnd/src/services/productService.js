import { normalizeString } from "../utils/vehicleUtils";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";
const REQUEST_TIMEOUT = 30000; // 30s para cobrir latência backend (~15s) + margem

function sanitizeString(str, maxLength = 100) {
  if (typeof str !== "string") return "";
  // remove caracteres potencialmente perigosos; o escape de " não é necessário dentro do []
  return str.replace(/[<>"'&]/g, "").trim().substring(0, maxLength);
}

function validatePaginationParams(page, limit) {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  return {
    page: isNaN(pageNum) || pageNum < 1 ? 1 : Math.min(pageNum, 1000),
    limit: isNaN(limitNum) || limitNum < 1 ? 20 : Math.min(limitNum, 100),
  };
}

function normalizeTipoVeiculoFilterFront(v) {
  const up = String(v || "").trim().toUpperCase();
  if (!up) return "";
  if (up === "MOTOR" || up === "M") return "MOTOR";
  if (up === "VEICULO" || up === "VEÍCULO" || up === "V") return "VEICULO";
  // compat
  if (up === "VLL" || up === "VLP" || up === "MLL" || up === "MLP") return up;
  return up;
}

function normalizeLinhaFilterFront(v) {
  const up = String(v || "").trim().toUpperCase();
  if (!up) return "";
  if (up === "LEVE" || up === "L") return "LEVE";
  if (up === "PESADA" || up === "PESADO" || up === "P") return "PESADA";
  // compat
  if (up === "VLL" || up === "VLP" || up === "MLL" || up === "MLP") return up;
  return up;
}

function validateFilters(filters) {
  const tv = normalizeTipoVeiculoFilterFront(filters.tipoVeiculo);
  const ln = normalizeLinhaFilterFront(filters.linha);

  return {
    search: sanitizeString(filters.search, 100),
    grupo: sanitizeString(filters.grupo, 50),
    fabricante: sanitizeString(filters.fabricante, 50),

    // NOVO
    tipoVeiculo: sanitizeString(tv, 50),
    linha: sanitizeString(ln, 50),

    numero_original: sanitizeString(filters.numero_original, 50),

    // permitir "descricao" também (se seu front usa)
    sortBy: ["codigo", "nome", "fabricante", "grupo", "descricao"].includes(filters.sortBy)
      ? filters.sortBy
      : "codigo",

    // preserva se vier
    isConjunto: filters.isConjunto,
  };
}

function normalizeCodeFront(code) {
  return String(code || "").replace(/\s+/g, "").toUpperCase().trim();
}

function validateProductCode(code) {
  const normalized = normalizeCodeFront(code);
  return normalized.length > 0 && normalized.length <= 50 ? normalized : null;
}

const cache = {
  products: null,
  conjuntos: null,
  filters: null,
  status: null,
  timestamp: 0,
  catalog: null,
  catalogTimestamp: 0,
  catalogFetching: null, // Promise para evitar requisições duplicadas
};

// 7 dias em millisegundos = 604.800.000ms (alterado de 1 hora)
const CACHE_DURATION = Number(process.env.REACT_APP_CATALOG_TTL_MS || 7 * 24 * 60 * 60 * 1000);
const STORAGE_KEY_CATALOG = "abr_catalog_snapshot";
const STORAGE_KEY_TIMESTAMP = "abr_catalog_timestamp";

/**
 * Funções de persistência localStorage com expiração
 */
function saveToLocalStorage(key, data, ttlMs = CACHE_DURATION) {
  try {
    const payload = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    // localStorage pode estar cheio ou desabilitado
    console.warn(`Falha ao salvar em localStorage (${key}):`, e.message);
  }
}

function getFromLocalStorage(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const payload = JSON.parse(item);
    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return payload.data;
  } catch (e) {
    console.warn(`Falha ao ler localStorage (${key}):`, e.message);
    return null;
  }
}

function clearLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Falha ao limpar localStorage (${key}):`, e.message);
  }
}

// Removido: isCacheValid() (não era usado e quebrava o build em CI)

function isCatalogCacheValid() {
  return Date.now() - cache.catalogTimestamp < CACHE_DURATION;
}

function restoreCatalogFromStorage() {
  const stored = getFromLocalStorage(STORAGE_KEY_CATALOG);
  if (stored && typeof stored === "object") {
    cache.catalog = stored;
    cache.catalogTimestamp = Date.now();
    console.log("[Cache] Catálogo restaurado do localStorage");
    return true;
  }
  return false;
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

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") throw new Error(`Requisição expirou (timeout ${REQUEST_TIMEOUT}ms)`);
    throw error;
  }
}

async function fetchWithRetry(url, options = {}, maxRetries = 0) {
  // OTIMIZAÇÃO: Sem retrys automáticos - backend é rápido e confiável
  // Se precisar de retrys, será feito no nível da aplicação (ex: em useEffect com estado)
  const response = await fetchWithTimeout(url, options);
  return response;
}

async function handleResponse(response) {
  if (!response) throw new Error("Resposta do servidor inválida");

  let body = {};
  try {
    if (response.status === 204) return null;
    body = await response.json();
  } catch (e) {
    const text = await response.text();
    if (!response.ok) throw new Error(`Erro HTTP ${response.status}: ${text.substring(0, 200)}`);
    return null;
  }

  if (!response.ok) throw new Error(body.error || `Erro HTTP ${response.status}`);
  if (typeof body !== "object" || body === null) throw new Error("Resposta do servidor não é um objeto JSON válido");
  return body;
}

function validateParams(params) {
  const { page = 1, limit = 20 } = params;
  const { page: validPage, limit: validLimit } = validatePaginationParams(page, limit);
  return { page: validPage, limit: validLimit };
}

// ====== Snapshot (catalog) helpers ======
export async function fetchCatalogSnapshot(force = false) {
  // Se não foi forçado e cache em-memória é válido, retorna
  if (!force && cache.catalog && isCatalogCacheValid()) {
    console.log("[Cache] Usando catálogo em-memória");
    return cache.catalog;
  }

  // Se há uma requisição em andamento, aguarda ela (evita requisições duplicadas)
  if (cache.catalogFetching) {
    console.log("[Cache] Aguardando requisição em andamento...");
    return cache.catalogFetching;
  }

  // Se não foi forçado, tenta restaurar do localStorage
  if (!force && !cache.catalog) {
    if (restoreCatalogFromStorage()) {
      return cache.catalog;
    }
  }

  console.log("[Cache] Buscando catálogo do servidor...");
  const url = `${API_BASE_URL}/catalog` + (force ? "?reload=1" : "");
  
  // Envolve em Promise para evitar requisições duplicadas enquanto uma está em andamento
  cache.catalogFetching = (async () => {
    try {
      const resp = await fetchWithRetry(url);
      const body = await handleResponse(resp);

      if (!body || !body.data) throw new Error("Resposta inválida ao buscar snapshot do catálogo");

      cache.catalog = body.data;
      cache.catalogTimestamp = Date.now();

      // Salva no localStorage para persistência entre sessões (7 dias)
      saveToLocalStorage(STORAGE_KEY_CATALOG, cache.catalog, CACHE_DURATION);
      console.log("[Cache] Catálogo salvo em localStorage");

      return cache.catalog;
    } finally {
      cache.catalogFetching = null; // Limpa após completar
    }
  })();

  return cache.catalogFetching;
}

export function getCachedCatalog() {
  return cache.catalog;
}

/**
 * REGRAS DE MATCH (aplicacoes.sigla_tipo):
 * - tipoVeiculo=MOTOR   => sigla_tipo começa com "M"
 * - tipoVeiculo=VEICULO => sigla_tipo começa com "V"
 * - linha=LEVE          => sigla_tipo termina com "L"
 * - linha=PESADA        => sigla_tipo termina com "P"
 * - compat: se vier VLL/VLP/MLL/MLP, compara direto com a sigla.
 */
function matchesAplicacaoSigla(siglaRaw, tipoVeiculoFilter, linhaFilter) {
  const sigla = String(siglaRaw || "").trim().toUpperCase();
  if (!sigla) return false;

  const tv = normalizeTipoVeiculoFilterFront(tipoVeiculoFilter);
  const ln = normalizeLinhaFilterFront(linhaFilter);

  // compat: se o filtro vier como sigla completa, exige igualdade
  if (tv && (tv === "VLL" || tv === "VLP" || tv === "MLL" || tv === "MLP")) {
    return sigla === tv;
  }
  if (ln && (ln === "VLL" || ln === "VLP" || ln === "MLL" || ln === "MLP")) {
    return sigla === ln;
  }

  if (tv === "MOTOR" && !sigla.startsWith("M")) return false;
  if (tv === "VEICULO" && !sigla.startsWith("V")) return false;

  if (ln === "LEVE" && !sigla.endsWith("L")) return false;
  if (ln === "PESADA" && !sigla.endsWith("P")) return false;

  return true;
}

export function filterCatalogSnapshot(snapshot, filters = {}, page = 1, limit = 20) {
  if (!snapshot || typeof snapshot !== "object") {
    return { data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } };
  }

  const productsArr = Array.isArray(snapshot.products) ? snapshot.products : [];
  const conjuntosArr = Array.isArray(snapshot.conjuntos) ? snapshot.conjuntos : [];
  const aplicacoesArr = Array.isArray(snapshot.aplicacoes) ? snapshot.aplicacoes : [];

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

  // Itens (conjuntos + produtos)
  const items = [];
  const productsByCode = new Map();
  for (const p of productsArr) {
    const code = (p.codigo_abr || p.codigo || "").toString().trim();
    if (code) productsByCode.set(code, p);
  }

  for (const [pai, filhos] of conjuntoChildrenMap.entries()) {
    const prod = productsByCode.get(pai) || {};
    const apps = appByConjunto.get(pai) || [];
    const fabricante = apps.length ? (apps[0].fabricante || "") : (prod.fabricante || "");
    const siglaTipo = apps.length ? (apps[0].sigla_tipo || "") : "";
    items.push({
      codigo: pai,
      descricao: prod.descricao || prod.nome || pai,
      grupo: prod.grupo || null,
      tipo: "conjunto",
      fabricante,
      sigla_tipo: siglaTipo,
      conjuntosChildren: filhos,
    });
  }

  for (const p of productsArr) {
    const codigo = (p.codigo_abr || p.codigo || "").toString().trim();
    if (!codigo) continue;
    const existsConjunto = items.some((i) => i.codigo === codigo && i.tipo === "conjunto");
    if (existsConjunto) continue;
    items.push({
      codigo,
      descricao: p.descricao || p.nome || codigo,
      grupo: p.grupo || null,
      tipo: "produto",
      fabricante: p.fabricante || p.origem || "",
      sigla_tipo: p.sigla_tipo || "",
    });
  }

  const validFilters = validateFilters(filters);

  const search = normalizeString(validFilters.search || "");
  const grupoFilter = (validFilters.grupo || "").toString().trim().toLowerCase();
  const fabricanteFilter = (validFilters.fabricante || "").toString().trim().toLowerCase();
  const tipoVeiculoFilter = validFilters.tipoVeiculo || "";
  const linhaFilter = validFilters.linha || "";
  const sortBy = validFilters.sortBy || "codigo";
  const isConjunto =
    validFilters.isConjunto === true ? "conjunto" : validFilters.isConjunto === false ? "produto" : null;

  // Precompute codes based on aplicacoes (fabricante/tipoVeiculo/linha)
  let matchingCodes = null;
  const hasAplicFilter = !!(fabricanteFilter || tipoVeiculoFilter || linhaFilter);
  if (hasAplicFilter) {
    matchingCodes = new Set();
    for (const [codigo_conjunto, apps] of appByConjunto.entries()) {
      const matchesFab = fabricanteFilter
        ? apps.some((a) => normalizeString(a.fabricante || "").includes(fabricanteFilter))
        : true;

      const matchesTipoLinha =
        tipoVeiculoFilter || linhaFilter
          ? apps.some((a) => matchesAplicacaoSigla(a.sigla_tipo || a.tipo, tipoVeiculoFilter, linhaFilter))
          : true;

      if (matchesFab && matchesTipoLinha) {
        matchingCodes.add(codigo_conjunto);
        const filhos = conjuntoChildrenMap.get(codigo_conjunto) || [];
        filhos.forEach((f) => matchingCodes.add(f));
      }
    }
  }

  const filtered = items.filter((it) => {
    if (isConjunto && it.tipo !== isConjunto) return false;

    // Quando há filtro de tipo/linha/fabricante: exige que o item esteja na lista calculada por aplicacoes
    if (matchingCodes) {
      if (!matchingCodes.has(it.codigo)) return false;
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
  });

  filtered.sort((a, b) => {
    if (sortBy === "descricao") return String(a.descricao || "").localeCompare(String(b.descricao || ""));
    if (sortBy === "grupo") return String(a.grupo || "").localeCompare(String(b.grupo || ""));
    return String(a.codigo || "").localeCompare(String(b.codigo || ""));
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const offset = (safePage - 1) * limit;
  const pageItems = filtered.slice(offset, offset + limit);

  return { data: pageItems, pagination: { page: safePage, limit, total, totalPages } };
}

// ====== API functions ======
export async function fetchProducts(search = "") {
  try {
    const url = new URL(`${API_BASE_URL}/products`);
    if (search && typeof search === "string") url.searchParams.set("search", search.trim().substring(0, 100));
    const response = await fetchWithRetry(url.toString());
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(`Falha ao carregar produtos: ${error.message}`);
  }
}

export async function fetchProductsPaginated(page = 1, limit = 20, filters = {}) {
  const { page: validPage, limit: validLimit } = validatePaginationParams(page, limit);
  const validFilters = validateFilters(filters);

  if (cache.catalog && isCatalogCacheValid()) {
    try {
      const result = filterCatalogSnapshot(cache.catalog, validFilters, validPage, validLimit);
      return { data: result.data, pagination: result.pagination };
    } catch (e) {
      console.warn("fetchProductsPaginated: fallback para API (erro no filtro local):", e.message || e);
    }
  }

  const url = new URL(`${API_BASE_URL}/products/paginated-optimized`);
  url.searchParams.set("page", String(validPage));
  url.searchParams.set("limit", String(validLimit));

  if (validFilters.search) url.searchParams.set("search", validFilters.search);
  if (validFilters.grupo) url.searchParams.set("grupo", validFilters.grupo);
  if (validFilters.fabricante) url.searchParams.set("fabricante", validFilters.fabricante);
  if (validFilters.tipoVeiculo) url.searchParams.set("tipoVeiculo", validFilters.tipoVeiculo);
  if (validFilters.linha) url.searchParams.set("linha", validFilters.linha);
  if (validFilters.numero_original) url.searchParams.set("numero_original", validFilters.numero_original);
  if (validFilters.sortBy) url.searchParams.set("sortBy", validFilters.sortBy);

  const response = await fetchWithRetry(url.toString());
  const body = await handleResponse(response);

  return {
    data: Array.isArray(body.data) ? body.data : [],
    pagination: {
      page: parseInt(body.pagination?.page) || validPage,
      limit: parseInt(body.pagination?.limit) || validLimit,
      total: parseInt(body.pagination?.total) || 0,
      totalPages:
        parseInt(body.pagination?.totalPages) ||
        Math.max(1, Math.ceil((parseInt(body.pagination?.total) || 0) / validLimit)),
    },
  };
}

export async function fetchConjuntosPaginated(page = 1, limit = 20, filters = {}) {
  const { page: validPage, limit: validLimit } = validateParams({ page, limit });
  const validFilters = validateFilters({ ...filters, isConjunto: true });

  if (cache.catalog && isCatalogCacheValid()) {
    try {
      const result = filterCatalogSnapshot(cache.catalog, validFilters, validPage, validLimit);
      return { data: result.data, pagination: result.pagination };
    } catch (e) {
      console.warn("fetchConjuntosPaginated: fallback para API (erro no filtro local):", e.message || e);
    }
  }

  const url = new URL(`${API_BASE_URL}/conjuntos/paginated`);
  url.searchParams.set("page", String(validPage));
  url.searchParams.set("limit", String(validLimit));

  if (validFilters.search) url.searchParams.set("search", validFilters.search);
  if (validFilters.grupo) url.searchParams.set("grupo", validFilters.grupo);
  if (validFilters.fabricante) url.searchParams.set("fabricante", validFilters.fabricante);
  if (validFilters.tipoVeiculo) url.searchParams.set("tipoVeiculo", validFilters.tipoVeiculo);
  if (validFilters.linha) url.searchParams.set("linha", validFilters.linha);
  if (validFilters.sortBy) url.searchParams.set("sortBy", validFilters.sortBy);

  const response = await fetchWithRetry(url.toString());
  const body = await handleResponse(response);

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
        Math.max(1, Math.ceil((parseInt(body.pagination?.total) || 0) / validLimit)),
    },
  };
}

export async function fetchProductDetails(code) {
  const validCode = validateProductCode(code);
  if (!validCode) throw new Error("Código do produto inválido");

  const normalizedCode = normalizeCodeFront(validCode);

  // snapshot fast-path
  if (cache.catalog && isCatalogCacheValid()) {
    const snap = cache.catalog;

    const byProducts = (Array.isArray(snap.products) ? snap.products : []).find(
      (p) => (p.codigo_abr || p.codigo || "").toString().trim().toUpperCase() === normalizedCode
    );
    if (byProducts) {
      const conjuntos = (Array.isArray(snap.conjuntos) ? snap.conjuntos : [])
        .filter((c) => (c.pai || c.codigo_conjunto || "").toString().trim().toUpperCase() === normalizedCode)
        .map((c) => ({
          filho: c.filho || c.codigo || c.codigo_componente || "",
          filho_des: c.filho_des || c.descricao || c.des || null,
          qtd_explosao: c.qtd_explosao || c.quantidade || c.qtd || 1,
        }));

      const aplicacoes = (Array.isArray(snap.aplicacoes) ? snap.aplicacoes : []).filter(
        (a) => (a.codigo_conjunto || "").toString().trim().toUpperCase() === normalizedCode
      );
      const benchmarks = (Array.isArray(snap.benchmarks) ? snap.benchmarks : []).filter(
        (b) => (b.codigo || "").toString().trim().toUpperCase() === normalizedCode
      );
      const memberships = (Array.isArray(snap.conjuntos) ? snap.conjuntos : [])
        .filter((c) => (c.filho || "").toString().trim().toUpperCase() === normalizedCode)
        .map((c) => ({
          codigo_conjunto: c.pai || c.codigo_conjunto || "",
          quantidade: c.qtd_explosao || c.quantidade || c.qtd || 1,
        }));

      return { data: { product: byProducts, conjuntos, aplicacoes, benchmarks, memberships } };
    }
  }

  // server
  const url = `${API_BASE_URL}/products/${encodeURIComponent(normalizedCode)}`;
  const resp = await fetchWithRetry(url);
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const text = await resp.text();
    throw new Error(
      `Resposta inesperada (HTML). Conteúdo truncado: ${text.substring(0, 200).replace(/\s+/g, " ")}`
    );
  }
  return await handleResponse(resp);
}

export async function fetchFilters() {
  try {
    const url = `${API_BASE_URL}/filters`;
    const response = await fetchWithRetry(url);
    const data = await handleResponse(response);

    const fabricantesRaw = Array.isArray(data.fabricantes) ? data.fabricantes : [];
    const fabricantes = fabricantesRaw
      .map((f) =>
        typeof f === "string"
          ? { name: f, count: 0 }
          : f && f.name
            ? { name: f.name, count: Number(f.count) || 0 }
            : null
      )
      .filter(Boolean);

    return {
      grupos: Array.isArray(data.grupos) ? data.grupos : [],
      fabricantes,
      vehicleTypes: Array.isArray(data.vehicle_types) ? data.vehicle_types : ["MOTOR", "VEICULO"],
      linhas: Array.isArray(data.linhas) ? data.linhas : ["LEVE", "PESADA"],
    };
  } catch (e) {
    return { grupos: [], fabricantes: [], vehicleTypes: ["MOTOR", "VEICULO"], linhas: ["LEVE", "PESADA"] };
  }
}

export async function fetchCatalogStatus() {
  try {
    if (cache.catalog && isCatalogCacheValid()) {
      const snap = cache.catalog;
      const totalProducts = Array.isArray(snap.products) ? snap.products.length : 0;
      const totalConjuntos = Array.isArray(snap.conjuntos)
        ? new Set(snap.conjuntos.map((c) => c.pai || c.codigo_conjunto)).size
        : 0;
      return { totalProducts, totalConjuntos, lastUpdate: new Date(cache.catalogTimestamp).toISOString() };
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

// Tentar restaurar catálogo do localStorage na inicialização\nif (typeof window !== \"undefined\" && window.localStorage) {\n  restoreCatalogFromStorage();\n}\n\nexport { invalidateCache as invalidateSimpleCache, invalidateCatalog };
