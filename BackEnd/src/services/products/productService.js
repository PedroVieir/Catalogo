import * as repo from "./productRepository.js";
import * as cache from "./productCache.js";
import * as utils from "./productUtils.js";

const CACHE_KEYS = {
    PRODUCTS_ALL: "products:all",
    CONJUNTOS_ALL: "conjuntos:all",
    APLICACOES_ALL: "aplicacoes:all",
    BENCHMARKS_ALL: "benchmarks:all",
    FABRICANTES_ALL: "fabricantes:all"
};

const CACHE_TTL_MS = Number(process.env.PRODUCTS_CACHE_TTL_MS || 60 * 60 * 1000);

export async function getAllProductsCached() {
    const cached = await cache.cacheGet(CACHE_KEYS.PRODUCTS_ALL);
    if (cached) return cached.slice();
    const rows = await repo.fetchAllProductsRaw();
    const normalized = (rows || []).map(r => ({
        codigo: utils.normalizeCodigo(r.codigo_abr),
        codigo_abr: String(r.codigo_abr || "").trim(),
        descricao: utils.normalizeTexto(r.descricao) || null,
        grupo: r.grupo || null
    }));
    await cache.cacheSet(CACHE_KEYS.PRODUCTS_ALL, normalized, CACHE_TTL_MS);
    return normalized.slice();
}

export async function getAllConjuntosCached() {
    const cached = await cache.cacheGet(CACHE_KEYS.CONJUNTOS_ALL);
    if (cached) return cached.slice();
    const rows = await repo.fetchConjuntosRaw();
    const normalized = (rows || []).map(r => ({
        pai: utils.normalizeCodigo(r.pai),
        filho: utils.normalizeCodigo(r.filho),
        filho_des: utils.normalizeTexto(r.filho_des) || null,
        qtd_explosao: Number(r.quantidade) || 1
    }));
    await cache.cacheSet(CACHE_KEYS.CONJUNTOS_ALL, normalized, CACHE_TTL_MS);
    return normalized.slice();
}

export async function getAllAplicacoesCached() {
    const cached = await cache.cacheGet(CACHE_KEYS.APLICACOES_ALL);
    if (cached) return cached.slice();
    const rows = await repo.fetchAplicacoesRaw();
    const normalized = (rows || []).map(r => ({
        id: r.id,
        codigo_conjunto: utils.normalizeCodigo(r.codigo_conjunto),
        codigo_conjunto_raw: String(r.codigo_conjunto || "").trim(),
        veiculo: utils.normalizeTexto(r.veiculo) || null,
        fabricante: utils.normalizeTexto(r.fabricante) || null,
        tipo: utils.normalizeTexto(r.tipo) || null,
        sigla_tipo: utils.normalizeCodigo(r.sigla_tipo) || null
    }));
    await cache.cacheSet(CACHE_KEYS.APLICACOES_ALL, normalized, CACHE_TTL_MS);
    return normalized.slice();
}

export async function getAllBenchmarksCached() {
    const cached = await cache.cacheGet(CACHE_KEYS.BENCHMARKS_ALL);
    if (cached) return cached.slice();
    const rows = await repo.fetchBenchmarksRaw();
    const normalized = (rows || []).map(r => ({
        id: r.id,
        codigo: utils.normalizeCodigo(r.codigo_produto),
        codigo_produto: String(r.codigo_produto || "").trim(),
        origem: utils.normalizeTexto(r.origem) || null,
        numero_original: utils.normalizeTexto(r.numero_original) || null
    }));
    await cache.cacheSet(CACHE_KEYS.BENCHMARKS_ALL, normalized, CACHE_TTL_MS);
    return normalized.slice();
}

export async function getFabricantesCached() {
    const cached = await cache.cacheGet(CACHE_KEYS.FABRICANTES_ALL);
    if (cached) return cached.slice();
    const rows = await repo.fetchFabricantesRaw();
    const normalized = (rows || []).map(r => ({
        name: utils.normalizeTexto(r.name),
        count: Number(r.count) || 0
    }));
    await cache.cacheSet(CACHE_KEYS.FABRICANTES_ALL, normalized, CACHE_TTL_MS);
    return normalized.slice();
}

export async function preloadCatalog() {
    await Promise.all([
        getAllProductsCached(),
        getAllConjuntosCached(),
        getAllBenchmarksCached(),
        getAllAplicacoesCached(),
        getFabricantesCached()
    ]);
}

export async function invalidateAllCaches() {
    await Promise.all([
        cache.cacheDel(CACHE_KEYS.PRODUCTS_ALL),
        cache.cacheDel(CACHE_KEYS.CONJUNTOS_ALL),
        cache.cacheDel(CACHE_KEYS.APLICACOES_ALL),
        cache.cacheDel(CACHE_KEYS.BENCHMARKS_ALL),
        cache.cacheDel(CACHE_KEYS.FABRICANTES_ALL)
    ]);
}

export async function reloadCatalog() {
    await invalidateAllCaches();
    await preloadCatalog();
}

export async function getProductsPaginated({ page = 1, limit = 20, filters = {} } = {}) {
    const { total, data: rawRows } = await repo.fetchProductsPaginated({ page, limit, filters });
    const normalized = (rawRows || []).map(r => ({
        codigo: utils.normalizeCodigo(r.codigo_abr),
        codigo_abr: String(r.codigo_abr || "").trim(),
        descricao: utils.normalizeTexto(r.descricao) || null,
        grupo: r.grupo || null
    }));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        data: normalized,
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
        meta: { queryOptimized: true }
    };
}

export async function getProductsPaginatedOptimized(page = 1, limit = 20, filters = {}) {
    return getProductsPaginated({ page, limit, filters });
}

export async function getConjuntosPaginated({ page = 1, limit = 20, filters = {} } = {}) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    const shouldLoadAplicacoes = !!(
        (filters.fabricante && String(filters.fabricante).trim()) ||
        (filters.tipoVeiculo && String(filters.tipoVeiculo).trim()) ||
        (filters.linha && String(filters.linha).trim())
    );

    const [conjuntos, products, aplicacoes] = await Promise.all([
        getAllConjuntosCached(),
        getAllProductsCached(),
        shouldLoadAplicacoes ? getAllAplicacoesCached() : Promise.resolve([])
    ]);

    const productMap = new Map(products.map(p => [p.codigo, p]));
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

    if (shouldLoadAplicacoes) {
        const fabricanteFilter = (filters.fabricante && String(filters.fabricante).trim())
            ? (s => (s || "").toLowerCase().includes(String(filters.fabricante).trim().toLowerCase()))
            : () => true;

        const matchingConjuntos = new Set();
        aplicacoes.forEach(a => {
            const fabricaMatch = fabricanteFilter(a.fabricante || "");
            const tipoMatch = !filters.tipoVeiculo || utils.matchesTipoVeiculoFilter(a, filters.tipoVeiculo);
            const linhaMatch = !filters.linha || utils.matchesLinhaFilter(a, filters.linha);

            if (fabricaMatch && tipoMatch && linhaMatch) matchingConjuntos.add(a.codigo_conjunto);
        });

        parents = parents.filter(p => matchingConjuntos.has(p.codigo));
    }

    if (filters.search && typeof filters.search === "string") {
        const sf = utils.createSearchFilter(filters.search);
        parents = parents.filter(parent => {
            if (sf(parent.codigo) || sf(parent.descricao)) return true;
            return parent.children.some(ch => sf(ch.filho) || sf(ch.filho_des));
        });
    }

    if (filters.grupo && typeof filters.grupo === "string") {
        const g = filters.grupo.trim().toLowerCase();
        parents = parents.filter(p => p.grupo && p.grupo.toLowerCase() === g);
    }

    const sortBy = filters.sortBy || "codigo";
    parents.sort((a, b) => {
        if (sortBy === "descricao") return (a.descricao || "").localeCompare(b.descricao || "");
        if (sortBy === "grupo") return (a.grupo || "").localeCompare(b.grupo || "");
        return (a.codigo || "").localeCompare(b.codigo || "");
    });

    const total = parents.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const data = parents.slice(offset, offset + limit);

    return {
        data,
        pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
    };
}

export async function getProductWithConjuntos(code) {
    if (!code) return null;
    const upCode = utils.normalizeCodigo(code);
    const [products, conjuntos, benchmarks, aplicacoes] = await Promise.all([
        getAllProductsCached(),
        getAllConjuntosCached(),
        getAllBenchmarksCached(),
        getAllAplicacoesCached()
    ]);

    const product = products.find(p => utils.normalizeCodigo(p.codigo) === upCode);
    if (!product) return null;

    const productConjuntos = conjuntos.filter(c => utils.normalizeCodigo(c.pai) === utils.normalizeCodigo(product.codigo));
    const memberships = conjuntos
        .filter(c => utils.normalizeCodigo(c.filho) === utils.normalizeCodigo(product.codigo))
        .map(c => ({ codigo_conjunto: c.pai, quantidade: c.qtd_explosao }));

    const productBenchmarks = benchmarks.filter(b => utils.normalizeCodigo(b.codigo) === utils.normalizeCodigo(product.codigo));

    let productAplicacoes = [];
    if (productConjuntos.length > 0) {
        productAplicacoes = aplicacoes.filter(a => utils.normalizeCodigo(a.codigo_conjunto) === utils.normalizeCodigo(product.codigo));
    } else {
        const conjuntoCodes = memberships.map(m => m.codigo_conjunto);
        productAplicacoes = aplicacoes.filter(a => conjuntoCodes.some(cc => utils.normalizeCodigo(a.codigo_conjunto) === utils.normalizeCodigo(cc)));
    }

    return { product, conjuntos: productConjuntos, conjuntosCount: productConjuntos.length, aplicacoes: productAplicacoes, benchmarks: productBenchmarks, memberships };
}

export async function getConjuntoWithProducts(code) {
    if (!code) return null;
    const upCode = utils.normalizeCodigo(code);
    const [products, conjuntos, aplicacoes] = await Promise.all([getAllProductsCached(), getAllConjuntosCached(), getAllAplicacoesCached()]);
    const parentProduct = products.find(p => utils.normalizeCodigo(p.codigo) === upCode);
    if (!parentProduct) return null;

    const childConjuntos = conjuntos.filter(c => utils.normalizeCodigo(c.pai) === utils.normalizeCodigo(parentProduct.codigo));
    const productAplicacoes = aplicacoes.filter(a => utils.normalizeCodigo(a.codigo_conjunto) === utils.normalizeCodigo(parentProduct.codigo));

    return { parentProduct, conjuntos: childConjuntos, childrenCount: childConjuntos.length, aplicacoes: productAplicacoes };
}

export async function searchProducts(searchTerm = "") {
    if (!searchTerm || typeof searchTerm !== "string") {
        const products = await getAllProductsCached();
        return products.slice(0, 100);
    }
    const { data } = await getProductsPaginated({ page: 1, limit: 100, filters: { search: searchTerm } });
    return data;
}

export async function getAvailableFilters() {
    const [products, benchmarks, aplicacoes, fabricantes] = await Promise.all([
        getAllProductsCached(),
        getAllBenchmarksCached(),
        getAllAplicacoesCached(),
        getFabricantesCached()
    ]);

    const grupos = new Set();
    products.forEach(p => { if (p.grupo) grupos.add(p.grupo); });
    const numeros = [...new Set(benchmarks.map(b => b.numero_original).filter(Boolean))].slice(0, 50);

    return {
        grupos: Array.from(grupos).sort(),
        numeros_original: numeros,
        fabricantes,

        // NOVO: opções “destrinchadas”
        vehicle_types: ["MOTOR", "VEICULO"],
        linhas: ["LEVE", "PESADA"],

        metadata: {
            totalProdutos: products.length,
            totalConjuntos: new Set((await getAllConjuntosCached()).map(c => c.pai)).size,
            ultimaAtualizacao: new Date().toISOString()
        }
    };
}

export async function getCatalogSnapshot() {
    await preloadCatalog();
    const [products, conjuntos, benchmarks, aplicacoes, fabricantes] = await Promise.all([
        getAllProductsCached(),
        getAllConjuntosCached(),
        getAllBenchmarksCached(),
        getAllAplicacoesCached(),
        getFabricantesCached()
    ]);
    return { products: products.slice(), conjuntos: conjuntos.slice(), benchmarks: benchmarks.slice(), aplicacoes: aplicacoes.slice(), fabricantes: fabricantes.slice(), _cachedAtMs: Date.now() };
}

export async function getCatalogStats() {
    const [products, conjuntos] = await Promise.all([getAllProductsCached(), getAllConjuntosCached()]);
    const paiUnicos = new Set(conjuntos.map(c => c.pai));
    return {
        totalProducts: products.length,
        totalConjuntos: paiUnicos.size,
        lastUpdate: new Date().toISOString(),
        cacheStatus: {
            produtos: { isCached: true, ageSeconds: null },
            conjuntos: { isCached: true, ageSeconds: null }
        }
    };
}

export async function ensureFabricantesPopulated() { return repo.ensureFabricantesPopulated(); }
