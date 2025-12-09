import { query } from "../config/db.js";

// Cache simples com versionamento
let productCache = null;
let conjuntoCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Limpar cache quando necessário
function invalidateCache() {
  productCache = null;
  conjuntoCache = null;
  cacheTimestamp = 0;
}

// Buscar todos os produtos (com cache)
async function getAllProducts() {
  const now = Date.now();
  
  if (productCache && now - cacheTimestamp < CACHE_DURATION) {
    return productCache;
  }

  const products = await query(
    `SELECT codigo, descricao, grupo, subgrupo 
     FROM produtos 
     WHERE codigo IS NOT NULL 
     ORDER BY codigo`
  );

  productCache = products;
  cacheTimestamp = now;
  return products;
}

// Buscar todos os conjuntos (com cache)
async function getAllConjuntos() {
  const now = Date.now();
  
  if (conjuntoCache && now - cacheTimestamp < CACHE_DURATION) {
    return conjuntoCache;
  }

  const conjuntos = await query(
    `SELECT pai, filho, filho_des, qtd_explosao 
     FROM conjuntos 
     WHERE pai IS NOT NULL AND filho IS NOT NULL 
     ORDER BY pai, filho`
  );

  conjuntoCache = conjuntos;
  cacheTimestamp = now;
  return conjuntos;
}

// ====== PRODUTOS - PAGINAÇÃO ======

export async function getProductsPaginated(page = 1, limit = 20, filters = {}) {
  const products = await getAllProducts();
  
  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  if (page < 1) page = 1;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;

  let filtered = products;

  // Filtros simples
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(p => 
      p.codigo.toLowerCase().includes(searchLower) ||
      (p.descricao && p.descricao.toLowerCase().includes(searchLower))
    );
  }

  if (filters.grupo) {
    filtered = filtered.filter(p => p.grupo === filters.grupo);
  }

  if (filters.subgrupo) {
    filtered = filtered.filter(p => p.subgrupo === filters.subgrupo);
  }

  // Calcular paginação
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const paginated = filtered.slice(offset, offset + limit);

  return {
    data: paginated,
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

export async function getConjuntosPaginated(page = 1, limit = 20, filters = {}) {
  const conjuntos = await getAllConjuntos();
  const products = await getAllProducts();

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  if (page < 1) page = 1;
  if (limit > 100) limit = 100;
  if (limit < 1) limit = 1;

  // Group by parent (pai) to build conjunto parents with children
  const parentsMap = new Map();
  const productMap = new Map(products.map(p => [p.codigo, p]));

  conjuntos.forEach((row) => {
    const pai = row.pai;
    if (!parentsMap.has(pai)) {
      const prod = productMap.get(pai) || {};
      parentsMap.set(pai, {
        codigo: pai,
        descricao: prod.descricao || pai,
        grupo: prod.grupo || "",
        children: []
      });
    }

    const parent = parentsMap.get(pai);
    // Normalize qtd_explosao: treat values like '6.000' as 6, ignore zero quantities
    let qtd = 1;
    if (row.qtd_explosao !== undefined && row.qtd_explosao !== null) {
      const n = Number(row.qtd_explosao);
      if (!Number.isNaN(n)) {
        qtd = Math.round(n);
      }
    }

    if (qtd > 0) {
      parent.children.push({
        filho: row.filho,
        filho_des: row.filho_des,
        qtd_explosao: qtd
      });
    }
  });

  // Convert to array of parents
  let parents = Array.from(parentsMap.values());

  // Apply filters at parent-level: search in parent codigo/descricao or in child codigo/descricao
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    parents = parents.filter(parent => {
      if ((parent.codigo || "").toLowerCase().includes(searchLower)) return true;
      if ((parent.descricao || "").toLowerCase().includes(searchLower)) return true;
      // check children
      return parent.children.some(ch =>
        (ch.codigo || "").toLowerCase().includes(searchLower) ||
        (ch.descricao || "").toLowerCase().includes(searchLower)
      );
    });
  }

  if (filters.grupo) {
    parents = parents.filter(p => p.grupo === filters.grupo);
  }

  const total = parents.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const paginatedParents = parents.slice(offset, offset + limit);

  return {
    data: paginatedParents,
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

// ====== BUSCA SIMPLES ======

export async function searchProducts(search) {
  const products = await getAllProducts();
  
  if (!search) return products;

  const searchLower = search.toLowerCase();
  return products.filter(p => 
    p.codigo.toLowerCase().includes(searchLower) ||
    (p.descricao && p.descricao.toLowerCase().includes(searchLower))
  );
}

export async function getProductWithConjuntos(code) {
  if (!code) return null;

  const products = await getAllProducts();
  const conjuntos = await getAllConjuntos();

  const product = products.find(p => p.codigo === code.toUpperCase());
  if (!product) return null;

  const productConjuntos = conjuntos.filter(c => c.pai === product.codigo);

  return {
    product,
    conjuntos: productConjuntos,
    conjuntosCount: productConjuntos.length
  };
}

export async function getConjuntoWithProducts(code) {
  if (!code) return null;

  const products = await getAllProducts();
  const conjuntos = await getAllConjuntos();

  const parentProduct = products.find(p => p.codigo === code.toUpperCase());
  if (!parentProduct) return null;

  const childConjuntos = conjuntos.filter(c => c.pai === parentProduct.codigo);

  return {
    parentProduct,
    conjuntos: childConjuntos,
    childrenCount: childConjuntos.length
  };
}

// ====== FILTROS E METADADOS ======

export async function getAvailableFilters() {
  const products = await getAllProducts();
  const conjuntos = await getAllConjuntos();

  const grupos = new Set();
  const subgrupos = new Set();

  products.forEach(p => {
    if (p.grupo) grupos.add(p.grupo);
    if (p.subgrupo) subgrupos.add(p.subgrupo);
  });

  return {
    grupos: Array.from(grupos).sort(),
    subgrupos: Array.from(subgrupos).sort(),
    metadata: {
      totalProdutos: products.length,
      totalConjuntos: conjuntos.length,
      ultimaAtualizacao: new Date().toISOString()
    }
  };
}

export async function getCatalogStats() {
  const products = await getAllProducts();
  const conjuntos = await getAllConjuntos();

  const paiUnicos = new Set(conjuntos.map(c => c.pai));
  const filhoUnicos = new Set(conjuntos.map(c => c.filho));

  return {
    totalProdutos: products.length,
    totalConjuntos: conjuntos.length,
    totalPaisUnicos: paiUnicos.size,
    totalFilhosUnicos: filhoUnicos.size,
    percentualProdutosComConjuntos: products.length > 0 
      ? (paiUnicos.size / products.length * 100).toFixed(2) 
      : 0,
    cacheStatus: {
      isCached: productCache !== null || conjuntoCache !== null,
      cacheAge: Math.floor((Date.now() - cacheTimestamp) / 1000)
    }
  };
}
