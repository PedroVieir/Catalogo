// src/services/productService.js
import { query } from "../config/db.js";

/**
 * productService.js
 * Versão refatorada e defensiva:
 * - Remove duplicidade de declarações
 * - Trata erros de DB
 * - Usa caches por entidade com timestamps
 * - Normaliza consistentemente códigos/textos
 * - Evita retornar referências diretas aos caches (retorna cópias)
 * - Valida parâmetros de entrada
 */

// ---------------------- Caches ----------------------
const caches = {
  produtos: { data: null, timestamp: 0 },
  conjuntos: { data: null, timestamp: 0 },
  benchmarks: { data: null, timestamp: 0 },
  aplicacoes: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 60 * 60 * 1000; // 1 hora (ms)

// invalidar caches (útil para reload manual)
function invalidateCache() {
  Object.keys(caches).forEach((k) => {
    caches[k].data = null;
    caches[k].timestamp = 0;
  });
}

// Força recarga do catálogo (exportado)
export async function reloadCatalog() {
  invalidateCache();
  await preloadCatalog();
}

// ---------------------- Normalização / Helpers ----------------------
function normalizeCodigo(codigo) {
  if (codigo === null || codigo === undefined) return "";
  return String(codigo).toUpperCase().replace(/\s+/g, "").trim();
}

function normalizeTexto(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto).trim();
}

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

// precompiled helper para buscas (case-insensitive contains)
function createSearchFilter(searchTerm) {
  const s = String(searchTerm || "").trim().toLowerCase();
  return (text) => !!text && String(text).toLowerCase().includes(s);
}

// matchesTipoFilter - implementação defensiva conforme seu código anterior
export function matchesTipoFilter(aplicacao = {}, tipoFilter = "") {
  if (!tipoFilter) return true;

  const tfRaw = String(tipoFilter || "").trim().toLowerCase();
  const tipo = (aplicacao.tipo || "").toString().toLowerCase();
  const sigla = (aplicacao.sigla_tipo || "").toString().toLowerCase();

  const canonical = ["vll", "vlp", "mll", "mlp"];

  if (canonical.includes(tfRaw)) {
    return sigla === tfRaw;
  }

  if (tfRaw === "leve") {
    if (tipo.includes("lev")) return true;
    if (tipo.includes("linha")) return true;
    if (sigla.includes("l") && !sigla.includes("p")) return true;
    return false;
  }

  if (tfRaw === "pesado") {
    if (tipo.includes("pesad")) return true;
    if (sigla.includes("p")) return true;
    return false;
  }

  return tipo.includes(tfRaw) || sigla.includes(tfRaw);
}

// ---------------------- Acesso às entidades (com cache) ----------------------
async function runQuerySafe(sql, params = []) {
  try {
    const rows = await query(sql, params);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error("DB query failed:", err && err.message ? err.message : err);
    return [];
  }
}

export async function getAllProducts() {
  const cache = caches.produtos;
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data.slice(); // retorna cópia
  }

  const rows = await runQuerySafe(`
    SELECT 
      TRIM(codigo_abr) as codigo_abr,
      TRIM(descricao) as descricao,
      TRIM(grupo) as grupo
    FROM produtoss 
    WHERE codigo_abr IS NOT NULL AND TRIM(codigo_abr) != ''
    ORDER BY codigo_abr
  `);

  const normalized = rows.map((r) => ({
    codigo: normalizeCodigo(r.codigo_abr),
    codigo_abr: String(r.codigo_abr || "").trim(),
    descricao: normalizeTexto(r.descricao) || null,
    grupo: r.grupo || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized.slice();
}

export async function getAllConjuntos() {
  const cache = caches.conjuntos;
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data.slice();
  }

  const rows = await runQuerySafe(`
    SELECT 
      TRIM(ec.codigo_conjunto) as pai,
      TRIM(ec.codigo_componente) as filho,
      ec.quantidade as quantidade,
      p.descricao as filho_des
    FROM estrutura_conjunto ec
    LEFT JOIN produtoss p ON TRIM(p.codigo_abr) = TRIM(ec.codigo_componente)
    WHERE ec.codigo_conjunto IS NOT NULL 
      AND TRIM(ec.codigo_conjunto) != ''
      AND ec.codigo_componente IS NOT NULL
      AND TRIM(ec.codigo_componente) != ''
    ORDER BY ec.codigo_conjunto, ec.codigo_componente
  `);

  const normalized = rows.map((r) => ({
    pai: normalizeCodigo(r.pai),
    filho: normalizeCodigo(r.filho),
    filho_des: normalizeTexto(r.filho_des) || null,
    qtd_explosao: Number(r.quantidade) || 1
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized.slice();
}

export async function getAllBenchmarks() {
  const cache = caches.benchmarks;
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data.slice();
  }

  const rows = await runQuerySafe(`
    SELECT id, codigo_produto, origem, numero_original
    FROM benchmarks
    WHERE codigo_produto IS NOT NULL AND codigo_produto != ''
  `);

  const normalized = rows.map((r) => ({
    id: r.id,
    codigo: normalizeCodigo(r.codigo_produto),
    codigo_produto: String(r.codigo_produto || "").trim(),
    origem: normalizeTexto(r.origem) || null,
    numero_original: normalizeTexto(r.numero_original) || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized.slice();
}

export async function getAllAplicacoes() {
  const cache = caches.aplicacoes;
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data.slice();
  }

  const rows = await runQuerySafe(`
    SELECT id, codigo_conjunto, veiculo, fabricante, tipo, sigla_tipo
    FROM aplicacoes
    WHERE codigo_conjunto IS NOT NULL AND codigo_conjunto != ''
  `);

  const normalized = rows.map((r) => ({
    id: r.id,
    codigo_conjunto: normalizeCodigo(r.codigo_conjunto),
    codigo_conjunto_raw: String(r.codigo_conjunto || "").trim(),
    veiculo: normalizeTexto(r.veiculo) || null,
    fabricante: normalizeTexto(r.fabricante) || null,
    tipo: normalizeTexto(r.tipo) || null,
    sigla_tipo: normalizeCodigo(r.sigla_tipo) || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized.slice();
}

// ---------------------- Fabricantes (cache próprio) ----------------------
let fabricantesCache = null;
let fabricantesCacheTimestamp = 0;

export async function getFabricantes() {
  const now = Date.now();
  if (fabricantesCache && now - fabricantesCacheTimestamp < CACHE_DURATION) {
    return fabricantesCache.slice();
  }

  try {
    const rows = await runQuerySafe(`
      SELECT f.nome as name, COUNT(a.id) as count
      FROM fabricantes f
      LEFT JOIN aplicacoes a ON TRIM(a.fabricante) = f.nome
      GROUP BY f.nome
      ORDER BY f.nome
    `);

    fabricantesCache = rows.map((r) => ({
      name: normalizeTexto(r.name),
      count: Number(r.count) || 0
    }));
  } catch (err) {
    // fallback: construir fabricantes a partir de aplicacoes
    const aplicacoes = await getAllAplicacoes();
    const map = new Map();
    aplicacoes.forEach((a) => {
      if (a.fabricante) {
        const key = a.fabricante;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    fabricantesCache = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    fabricantesCache.sort((a, b) => a.name.localeCompare(b.name));
  }

  fabricantesCacheTimestamp = now;
  return fabricantesCache.slice();
}

// ---------------------- Preload & Snapshot ----------------------
export async function preloadCatalog() {
  try {
    await Promise.all([
      getAllProducts(),
      getAllConjuntos(),
      getAllBenchmarks(),
      getAllAplicacoes(),
      getFabricantes()
    ]);
    console.info("Catalog preloaded");
  } catch (err) {
    console.error("Falha ao pré-carregar catálogo:", err && err.message ? err.message : err);
  }
}

export async function getCatalogSnapshot() {
  await preloadCatalog();

  return {
    products: (caches.produtos.data || []).slice(),
    conjuntos: (caches.conjuntos.data || []).slice(),
    benchmarks: (caches.benchmarks.data || []).slice(),
    aplicacoes: (caches.aplicacoes.data || []).slice(),
    fabricantes: await getFabricantes(),
    _cachedAtMs: Math.min(
      caches.produtos.timestamp || Date.now(),
      caches.conjuntos.timestamp || Date.now(),
      caches.benchmarks.timestamp || Date.now(),
      caches.aplicacoes.timestamp || Date.now()
    )
  };
}

// ---------------------- Paginação / Filtros ----------------------
function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

// ====== PRODUTOS - PAGINAÇÃO OTIMIZADA ======
export async function getProductsPaginatedOptimized(page = 1, limit = 20, filters = {}) {
  const start = Date.now();

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (page - 1) * limit;

  // Preparar parâmetros para a query
  const params = [];
  const whereConditions = [];

  // Filtro de grupo
  if (filters.grupo && typeof filters.grupo === "string" && filters.grupo.trim()) {
    whereConditions.push("TRIM(p.grupo) = ?");
    params.push(filters.grupo.trim());
  }

  // Filtro de busca (código ou descrição)
  if (filters.search && typeof filters.search === "string" && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    whereConditions.push("(p.codigo_abr LIKE ? OR p.descricao LIKE ?)");
    params.push(searchTerm, searchTerm);
  }

  // Filtro de fabricante/tipo veículo (usando subquery otimizada)
  let fabricanteCondition = "";
  if ((filters.fabricante && typeof filters.fabricante === "string" && filters.fabricante.trim()) ||
    (filters.tipoVeiculo && typeof filters.tipoVeiculo === "string" && filters.tipoVeiculo.trim())) {

    const fabConditions = [];
    const fabParams = [];

    if (filters.fabricante && filters.fabricante.trim()) {
      fabConditions.push("TRIM(a.fabricante) LIKE ?");
      fabParams.push(`%${filters.fabricante.trim()}%`);
    }

    if (filters.tipoVeiculo && filters.tipoVeiculo.trim()) {
      fabConditions.push("a.sigla_tipo = ?");
      fabParams.push(filters.tipoVeiculo.trim());
    }

    if (fabConditions.length > 0) {
      fabricanteCondition = `
        AND (
          p.codigo_abr IN (
            SELECT DISTINCT a.codigo_conjunto
            FROM aplicacoes a
            WHERE a.codigo_conjunto IS NOT NULL
            AND ${fabConditions.join(" AND ")}
          )
          OR p.codigo_abr IN (
            SELECT DISTINCT ec.codigo_componente
            FROM estrutura_conjunto ec
            INNER JOIN aplicacoes a ON ec.codigo_conjunto = a.codigo_conjunto
            WHERE ${fabConditions.join(" AND ")}
          )
        )`;
      params.push(...fabParams, ...fabParams); // Duplicado para as duas subqueries
    }
  }

  // Montar query principal
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

  // Ordenação
  const sortBy = (filters.sortBy === "descricao") ? "p.descricao" : "p.codigo_abr";
  const orderClause = `ORDER BY ${sortBy} ASC`;

  // Query para contar total
  const countQuery = `
    SELECT COUNT(*) as total
    FROM produtoss p
    ${whereClause}
    ${fabricanteCondition}
  `;

  // Query para buscar dados paginados
  const dataQuery = `
    SELECT
      TRIM(p.codigo_abr) as codigo_abr,
      TRIM(p.descricao) as descricao,
      TRIM(p.grupo) as grupo
    FROM produtoss p
    ${whereClause}
    ${fabricanteCondition}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  params.push(limit, offset);

  try {
    // Executar queries em paralelo
    const [countResult, dataResult] = await Promise.all([
      query(countQuery, params.slice(0, -2)), // Remover limit/offset para count
      query(dataQuery, params)
    ]);

    const total = parseInt(countResult[0]?.total) || 0;
    const totalPages = Math.ceil(total / limit);

    // Normalizar dados
    const data = dataResult.map(r => ({
      codigo: normalizeCodigo(r.codigo_abr),
      descricao: normalizeTexto(r.descricao) || null,
      grupo: r.grupo || null
    }));

    const duration = Date.now() - start;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      meta: {
        durationMs: duration,
        queryOptimized: true
      }
    };
  } catch (error) {
    console.error("Erro na query otimizada:", error);
    // Fallback para implementação anterior
    return getProductsPaginatedFallback(page, limit, filters);
  }
}

// Fallback para implementação anterior (mantido para compatibilidade)
function getProductsPaginatedFallback(page = 1, limit = 20, filters = {}) {
  const start = Date.now();

  page = clampNumber(page, 1, 99999, 1);
  limit = clampNumber(limit, 1, 100, 20);

  const [products, conjuntos, aplicacoes, benchmarks] = Promise.all([
    getAllProducts(),
    getAllConjuntos(),
    getAllAplicacoes(),
    getAllBenchmarks()
  ]);

  let filtered = products.slice();

  // search
  if (filters.search && typeof filters.search === "string") {
    const sf = createSearchFilter(filters.search);
    filtered = filtered.filter((p) => {
      return sf(p.codigo) || sf(p.descricao) || (p.grupo && sf(p.grupo));
    });
  }

  // grupo
  if (filters.grupo && typeof filters.grupo === "string") {
    const g = filters.grupo.trim().toLowerCase();
    filtered = filtered.filter((p) => p.grupo && p.grupo.toLowerCase() === g);
  }

  // numero_original (benchmarks)
  if (filters.numero_original && typeof filters.numero_original === "string") {
    const nf = createSearchFilter(filters.numero_original);
    const matchedCodes = new Set(
      benchmarks.filter((b) => b.numero_original && nf(b.numero_original)).map((b) => b.codigo)
    );
    filtered = filtered.filter((p) => matchedCodes.has(p.codigo));
  }

  // fabricante / tipoVeiculo via aplicacoes + conjuntos
  if ((filters.fabricante && typeof filters.fabricante === "string") || (filters.tipoVeiculo && typeof filters.tipoVeiculo === "string")) {
    const fabricanteTerm = filters.fabricante ? filters.fabricante.trim().toLowerCase() : null;
    const tipoTerm = filters.tipoVeiculo ? filters.tipoVeiculo : null;

    // identificar conjuntos válidos
    const matchingConjuntos = new Set();
    aplicacoes.forEach((a) => {
      const fabricaMatch = fabricanteTerm ? (a.fabricante && a.fabricante.toLowerCase().includes(fabricanteTerm)) : true;
      const tipoMatch = tipoTerm ? matchesTipoFilter(a, tipoTerm) : true;
      if (fabricaMatch && tipoMatch) matchingConjuntos.add(a.codigo_conjunto);
    });

    // incluir filhos dos conjuntos
    const produtosSet = new Set();
    matchingConjuntos.forEach((c) => produtosSet.add(c));
    conjuntos.forEach((c) => {
      if (matchingConjuntos.has(c.pai)) produtosSet.add(c.filho);
    });

    filtered = filtered.filter((p) => produtosSet.has(p.codigo));
  }

  // Ordenação
  const sortBy = (filters.sortBy || "codigo").toString();
  filtered.sort((a, b) => {
    if (sortBy === "descricao") return (a.descricao || "").localeCompare(b.descricao || "");
    return (a.codigo || "").localeCompare(b.codigo || "");
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  const durationMs = Date.now() - start;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    meta: {
      durationMs
    }
  };
}

export async function getProductsPaginated(page = 1, limit = 20, filters = {}) {
  const start = Date.now();

  page = clampNumber(page, 1, 99999, 1);
  limit = clampNumber(limit, 1, 100, 20);

  const [products, conjuntos, aplicacoes, benchmarks] = await Promise.all([
    getAllProducts(),
    getAllConjuntos(),
    getAllAplicacoes(),
    getAllBenchmarks()
  ]);

  let filtered = products.slice();

  // search
  if (filters.search && typeof filters.search === "string") {
    const sf = createSearchFilter(filters.search);
    filtered = filtered.filter((p) => {
      return sf(p.codigo) || sf(p.descricao) || (p.grupo && sf(p.grupo));
    });
  }

  // grupo
  if (filters.grupo && typeof filters.grupo === "string") {
    const g = filters.grupo.trim().toLowerCase();
    filtered = filtered.filter((p) => p.grupo && p.grupo.toLowerCase() === g);
  }

  // numero_original (benchmarks)
  if (filters.numero_original && typeof filters.numero_original === "string") {
    const nf = createSearchFilter(filters.numero_original);
    const matchedCodes = new Set(
      benchmarks.filter((b) => b.numero_original && nf(b.numero_original)).map((b) => b.codigo)
    );
    filtered = filtered.filter((p) => matchedCodes.has(p.codigo));
  }

  // fabricante / tipoVeiculo via aplicacoes + conjuntos
  if ((filters.fabricante && typeof filters.fabricante === "string") || (filters.tipoVeiculo && typeof filters.tipoVeiculo === "string")) {
    const fabricanteTerm = filters.fabricante ? filters.fabricante.trim().toLowerCase() : null;
    const tipoTerm = filters.tipoVeiculo ? filters.tipoVeiculo : null;

    // identificar conjuntos válidos
    const matchingConjuntos = new Set();
    aplicacoes.forEach((a) => {
      const fabricaMatch = fabricanteTerm ? (a.fabricante && a.fabricante.toLowerCase().includes(fabricanteTerm)) : true;
      const tipoMatch = tipoTerm ? matchesTipoFilter(a, tipoTerm) : true;
      if (fabricaMatch && tipoMatch) matchingConjuntos.add(a.codigo_conjunto);
    });

    // incluir filhos dos conjuntos
    const produtosSet = new Set();
    matchingConjuntos.forEach((c) => produtosSet.add(c));
    conjuntos.forEach((c) => {
      if (matchingConjuntos.has(c.pai)) produtosSet.add(c.filho);
    });

    filtered = filtered.filter((p) => produtosSet.has(p.codigo));
  }

  // Ordenação
  const sortBy = (filters.sortBy || "codigo").toString();
  filtered.sort((a, b) => {
    if (sortBy === "descricao") return (a.descricao || "").localeCompare(b.descricao || "");
    return (a.codigo || "").localeCompare(b.codigo || "");
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  const durationMs = Date.now() - start;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    meta: {
      durationMs
    }
  };
}

export async function getConjuntosPaginated(page = 1, limit = 20, filters = {}) {
  page = clampNumber(page, 1, 99999, 1);
  limit = clampNumber(limit, 1, 100, 20);

  const [conjuntos, products, aplicacoes] = await Promise.all([
    getAllConjuntos(),
    getAllProducts(),
    (filters.fabricante || filters.tipoVeiculo) ? getAllAplicacoes() : Promise.resolve([])
  ]);

  const productMap = new Map(products.map((p) => [p.codigo, p]));

  const parentsMap = new Map();
  for (const row of conjuntos) {
    const pai = row.pai;
    if (!parentsMap.has(pai)) {
      const prod = productMap.get(pai) || {};
      parentsMap.set(pai, {
        codigo: pai,
        descricao: prod.descricao || pai,
        grupo: prod.grupo || null,
        children: []
      });
    }
    const parent = parentsMap.get(pai);
    parent.children.push({
      filho: row.filho,
      filho_des: row.filho_des || null,
      qtd_explosao: row.qtd_explosao
    });
  }

  let parents = Array.from(parentsMap.values());

  // aplicar filtros de fabricante/tipo
  if (filters.fabricante || filters.tipoVeiculo) {
    const fabricanteFilter = filters.fabricante ? (s => (s || "").toLowerCase().includes(filters.fabricante.trim().toLowerCase())) : () => true;
    const matchingConjuntos = new Set();
    aplicacoes.forEach(a => {
      const fabricaMatch = fabricanteFilter(a.fabricante || "");
      const tipoMatch = !filters.tipoVeiculo || matchesTipoFilter(a, filters.tipoVeiculo);
      if (fabricaMatch && tipoMatch) matchingConjuntos.add(a.codigo_conjunto);
    });
    parents = parents.filter(p => matchingConjuntos.has(p.codigo));
  }

  if (filters.search && typeof filters.search === "string") {
    const sf = createSearchFilter(filters.search);
    parents = parents.filter(parent => {
      if (sf(parent.codigo) || sf(parent.descricao)) return true;
      return parent.children.some(ch => sf(ch.filho) || sf(ch.filho_des));
    });
  }

  if (filters.grupo && typeof filters.grupo === "string") {
    const g = filters.grupo.trim().toLowerCase();
    parents = parents.filter(p => p.grupo && p.grupo.toLowerCase() === g);
  }

  // ordenação
  const sortBy = filters.sortBy || "codigo";
  parents.sort((a, b) => {
    if (sortBy === "descricao") return (a.descricao || "").localeCompare(b.descricao || "");
    return (a.codigo || "").localeCompare(b.codigo || "");
  });

  const total = parents.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const data = parents.slice(offset, offset + limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

// ---------------------- Busca de produto detalhado ----------------------
export async function getProductWithConjuntos(code) {
  if (!code) return null;
  const upCode = normalizeCodigo(code);

  const [products, conjuntos, benchmarks, aplicacoes] = await Promise.all([
    getAllProducts(),
    getAllConjuntos(),
    getAllBenchmarks(),
    getAllAplicacoes()
  ]);

  const product = products.find(p => normalizeCodigo(p.codigo) === upCode);
  if (!product) return null;

  const productConjuntos = conjuntos.filter(c => normalizeCodigo(c.pai) === normalizeCodigo(product.codigo));
  const memberships = conjuntos
    .filter(c => normalizeCodigo(c.filho) === normalizeCodigo(product.codigo))
    .map(c => ({ codigo_conjunto: c.pai, quantidade: c.qtd_explosao }));

  // benchmarks do produto
  const productBenchmarks = benchmarks.filter(b => normalizeCodigo(b.codigo) === normalizeCodigo(product.codigo));

  // aplicações: se produto é conjunto -> aplicações diretas; senão -> aplicações dos conjuntos onde ele participa
  let productAplicacoes = [];
  if (productConjuntos.length > 0) {
    productAplicacoes = aplicacoes.filter(a => normalizeCodigo(a.codigo_conjunto) === normalizeCodigo(product.codigo));
  } else {
    const conjuntoCodes = memberships.map(m => m.codigo_conjunto);
    productAplicacoes = aplicacoes.filter(a => conjuntoCodes.some(cc => normalizeCodigo(a.codigo_conjunto) === normalizeCodigo(cc)));
  }

  return {
    product,
    conjuntos: productConjuntos,
    conjuntosCount: productConjuntos.length,
    aplicacoes: productAplicacoes,
    benchmarks: productBenchmarks,
    memberships
  };
}

export async function getConjuntoWithProducts(code) {
  if (!code) return null;
  const upCode = normalizeCodigo(code);

  const [products, conjuntos, aplicacoes] = await Promise.all([
    getAllProducts(),
    getAllConjuntos(),
    getAllAplicacoes()
  ]);

  const parentProduct = products.find(p => normalizeCodigo(p.codigo) === upCode);
  if (!parentProduct) return null;

  const childConjuntos = conjuntos.filter(c => normalizeCodigo(c.pai) === normalizeCodigo(parentProduct.codigo));
  const productAplicacoes = aplicacoes.filter(a => normalizeCodigo(a.codigo_conjunto) === normalizeCodigo(parentProduct.codigo));

  return {
    parentProduct,
    conjuntos: childConjuntos,
    childrenCount: childConjuntos.length,
    aplicacoes: productAplicacoes
  };
}

// ---------------------- Metadados / filtros disponíveis ----------------------
export async function getAvailableFilters() {
  const [products, benchmarks, aplicacoes, fabricantes] = await Promise.all([
    getAllProducts(),
    getAllBenchmarks(),
    getAllAplicacoes(),
    getFabricantes()
  ]);

  const grupos = new Set();
  products.forEach(p => { if (p.grupo) grupos.add(p.grupo); });

  const numeros = [...new Set(benchmarks.map(b => b.numero_original).filter(Boolean))].slice(0, 50);

  const canonicalSet = new Set(["VLL", "VLP", "MLL", "MLP"]);
  const foundSiglas = new Set();
  aplicacoes.forEach(a => {
    if (a.sigla_tipo && canonicalSet.has(a.sigla_tipo)) foundSiglas.add(a.sigla_tipo);
  });

  return {
    grupos: Array.from(grupos).sort(),
    numeros_original: numeros,
    fabricantes,
    vehicle_types: Array.from(foundSiglas).sort(),
    metadata: {
      totalProdutos: products.length,
      totalConjuntos: new Set((await getAllConjuntos()).map(c => c.pai)).size,
      ultimaAtualizacao: new Date().toISOString()
    }
  };
}

export async function getCatalogStats() {
  const [products, conjuntos] = await Promise.all([getAllProducts(), getAllConjuntos()]);
  const paiUnicos = new Set(conjuntos.map(c => c.pai));
  return {
    totalProducts: products.length,
    totalConjuntos: paiUnicos.size,
    lastUpdate: new Date().toISOString(),
    cacheStatus: {
      produtos: { isCached: caches.produtos.data !== null, ageSeconds: caches.produtos.timestamp ? Math.floor((Date.now() - caches.produtos.timestamp) / 1000) : null },
      conjuntos: { isCached: caches.conjuntos.data !== null, ageSeconds: caches.conjuntos.timestamp ? Math.floor((Date.now() - caches.conjuntos.timestamp) / 1000) : null }
    }
  };
}

// ---------------------- Auxiliares SQL ----------------------
export async function getProdutosFromConjuntos(conjuntoCodes) {
  // conjuntoCodes: Set or Array
  const codesArray = Array.isArray(conjuntoCodes) ? conjuntoCodes : Array.from(conjuntoCodes || []);
  if (codesArray.length === 0) return [];

  // construir placeholders seguros
  const placeholders = codesArray.map(() => "?").join(",");
  const sql = `
    SELECT DISTINCT p.codigo_abr, p.descricao, p.grupo
    FROM produtoss p
    INNER JOIN conjunto_produtos cp ON p.codigo_abr = cp.codigo_produto
    WHERE cp.codigo_conjunto IN (${placeholders})
  `;
  const rows = await runQuerySafe(sql, codesArray);
  return rows.map(r => ({
    codigo_abr: String(r.codigo_abr || "").trim(),
    descricao: normalizeTexto(r.descricao) || null,
    grupo: r.grupo || null
  }));
}

// ---------------------- Ensure fabricantes table populated ----------------------
export async function ensureFabricantesPopulated() {
  await runQuerySafe(`
    CREATE TABLE IF NOT EXISTS fabricantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      UNIQUE KEY unq_fabricante_nome (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await runQuerySafe(`
    INSERT IGNORE INTO fabricantes (nome)
    SELECT DISTINCT TRIM(fabricante) as nome
    FROM aplicacoes
    WHERE fabricante IS NOT NULL AND TRIM(fabricante) != ''
  `);
}

// ---------------------- Busca livre / utilitários ----------------------
export async function searchProducts(searchTerm = "") {
  const [products, benchmarks] = await Promise.all([getAllProducts(), getAllBenchmarks()]);

  if (!searchTerm || typeof searchTerm !== "string") return products.slice(0, 50);

  const term = searchTerm.trim().toLowerCase();

  const productMatches = products.filter(p =>
    (p.descricao || "").toLowerCase().includes(term) ||
    (p.codigo || "").toLowerCase().includes(term) ||
    ((p.grupo || "").toLowerCase().includes(term))
  );

  const benchmarkProductCodes = new Set(
    benchmarks
      .filter(b => b.numero_original && b.numero_original.toLowerCase().includes(term))
      .map(b => b.codigo)
  );

  const benchmarkMatches = products.filter(p => benchmarkProductCodes.has(p.codigo));

  const combined = [...productMatches, ...benchmarkMatches];
  const unique = combined.filter((p, idx, self) => self.findIndex(p2 => p2.codigo === p.codigo) === idx);

  return unique.slice(0, 100);
}

