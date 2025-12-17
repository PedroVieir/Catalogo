import { query } from "../config/db.js";

// Cache independente para cada entidade com timestamps próprios
const caches = {
  produtos: { data: null, timestamp: 0 },
  conjuntos: { data: null, timestamp: 0 },
  benchmarks: { data: null, timestamp: 0 },
  aplicacoes: { data: null, timestamp: 0 }
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function invalidateCache() {
  Object.keys(caches).forEach(key => {
    caches[key].data = null;
    caches[key].timestamp = 0;
  });
}

// Força recarga do catálogo (invalida cache e recarrega)
export async function reloadCatalog() {
  invalidateCache();
  await preloadCatalog();
}

function normalizeCodigo(codigo) {
  if (!codigo) return '';
  // Converter para string, maiúsculas e remover espaços
  return String(codigo).toUpperCase().replace(/\s+/g, '').trim();
}


// Função auxiliar para normalizar texto
function normalizeTexto(texto) {
  return String(texto || '').trim();
}

async function getAllProducts() {
  const cache = caches.produtos;
  const now = Date.now();
  
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  const rows = await query(`
    SELECT 
      TRIM(codigo_abr) as codigo_abr,
      TRIM(descricao) as descricao,
      TRIM(grupo) as grupo
    FROM produtoss 
    WHERE codigo_abr IS NOT NULL 
      AND TRIM(codigo_abr) != ''
    ORDER BY codigo_abr
  `);

  // fetched rows from DB
  const normalized = rows.map(r => ({
    codigo: normalizeCodigo(r.codigo_abr),
    descricao: normalizeTexto(r.descricao) || null,
    grupo: r.grupo || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized;
}

export async function debugProductSearch(code) {
  const upCode = normalizeCodigo(code);
  console.log('Código buscado:', code, 'Normalizado:', upCode);
  
  const products = await getAllProducts();
  const matches = products.filter(p => 
    normalizeCodigo(p.codigo) === upCode
  );
  
  console.log('Produtos encontrados:', matches.length);
  console.log('Primeiros 10 produtos no sistema:');
  products.slice(0, 10).forEach(p => {
    console.log(`  ${p.codigo} (normalizado: ${normalizeCodigo(p.codigo)})`);
  });
  
  return {
    buscado: code,
    normalizadoBuscado: upCode,
    encontrados: matches,
    totalProdutos: products.length
  };
}

async function getAllConjuntos() {
  const cache = caches.conjuntos;
  const now = Date.now();
  
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  // Adicione TRIM para remover espaços e garantir correspondência
  const rows = await query(`
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

  // fetched rows from DB
  const normalized = rows.map(r => ({
    pai: normalizeCodigo(r.pai),
    filho: normalizeCodigo(r.filho),
    filho_des: normalizeTexto(r.filho_des) || null,
    qtd_explosao: Number(r.quantidade) || 1
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized;
}

async function getAllBenchmarks() {
  const cache = caches.benchmarks;
  const now = Date.now();
  
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  // Índice recomendado: codigo_produto
  const rows = await query(`
    SELECT id, codigo_produto, origem, numero_original
    FROM benchmarks
    WHERE codigo_produto IS NOT NULL 
      AND codigo_produto != ''
  `);

  // fetched rows from DB
  const normalized = rows.map(r => ({
    id: r.id,
    codigo: normalizeCodigo(r.codigo_produto),
    origem: normalizeTexto(r.origem) || null,
    numero_original: normalizeTexto(r.numero_original) || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized;
}

async function getAllAplicacoes() {
  const cache = caches.aplicacoes;
  const now = Date.now();
  
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  // Índice recomendado: codigo_conjunto
  const rows = await query(`
    SELECT id, codigo_conjunto, veiculo, fabricante, tipo, sigla_tipo
    FROM aplicacoes
    WHERE codigo_conjunto IS NOT NULL 
      AND codigo_conjunto != ''
  `);

  // fetched rows from DB
  const normalized = rows.map(r => ({
    id: r.id,
    codigo_conjunto: normalizeCodigo(r.codigo_conjunto),
    veiculo: normalizeTexto(r.veiculo) || null,
    fabricante: normalizeTexto(r.fabricante) || null,
    tipo: normalizeTexto(r.tipo) || null,
    sigla_tipo: normalizeCodigo(r.sigla_tipo) || null
  }));

  cache.data = normalized;
  cache.timestamp = now;
  return normalized;
}

// Cache para fabricantes
let fabricantesCache = null;
let fabricantesCacheTimestamp = 0;

async function getFabricantes() {
  const now = Date.now();
  if (fabricantesCache && now - fabricantesCacheTimestamp < CACHE_DURATION) {
    return fabricantesCache;
  }

  // Buscar fabricantes da tabela ou das aplicações
  try {
    const rows = await query(`
      SELECT f.nome as name, COUNT(a.id) as count
      FROM fabricantes f
      LEFT JOIN aplicacoes a ON TRIM(a.fabricante) = f.nome
      GROUP BY f.nome
      ORDER BY f.nome
    `);
    // fetched rows from DB
    fabricantesCache = rows.map(r => ({ 
      name: r.name, 
      count: Number(r.count) 
    }));
  } catch (error) {
    // Fallback para aplicações se tabela fabricantes não existir
    const aplicacoes = await getAllAplicacoes();
    const fabricantesMap = new Map();
    
    aplicacoes.forEach(a => {
      if (a.fabricante) {
        const key = a.fabricante;
        fabricantesMap.set(key, (fabricantesMap.get(key) || 0) + 1);
      }
    });
    
    fabricantesCache = Array.from(fabricantesMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  
  fabricantesCacheTimestamp = now;
  return fabricantesCache;
}

/**
 * Carrega o catálogo completo em cache (uma única operação lógica).
 * Essa função popula os caches de produtos, conjuntos, benchmarks e aplicações
 * e garante que, após chamada, todas as informações necessárias estejam em memória
 * por CACHE_DURATION (5 minutos) para evitar múltiplas consultas repetidas.
 */
export async function preloadCatalog() {
  try {
    // Executa as cargas necessárias em paralelo
    await Promise.all([
      getAllProducts(),
      getAllConjuntos(),
      getAllBenchmarks(),
      getAllAplicacoes(),
      getFabricantes()
    ]);
    // apenas log essencial
    console.info('Catalog preloaded');
  } catch (err) {
    console.error('Falha ao pré-carregar catálogo:', err.message || err);
  }
}

// Otimização: pré-compilação de regex para filtros
function createSearchFilter(searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  return (text) => text && text.toLowerCase().includes(searchLower);
}

// ====== PRODUTOS - PAGINAÇÃO ======
export async function getProductsPaginated(page = 1, limit = 20, filters = {}) {
  const start = Date.now();

  // Carregar apenas os dados necessários
  const [products, conjuntos, aplicacoes] = await Promise.all([
    getAllProducts(),
    filters.fabricante || filters.tipoVeiculo ? getAllConjuntos() : Promise.resolve([]),
    filters.fabricante || filters.tipoVeiculo ? getAllAplicacoes() : Promise.resolve([])
  ]);

  let filtered = [...products]; // Cópia superficial para evitar mutação

  // Filtro de busca
  if (filters.search) {
    const searchFilter = createSearchFilter(filters.search);
    filtered = filtered.filter(p => 
      searchFilter(p.codigo) || searchFilter(p.descricao)
    );
  }

  // Filtro de grupo
  if (filters.grupo) {
    filtered = filtered.filter(p => p.grupo === filters.grupo);
  }

  // Filtro por número original (carregar benchmarks apenas se necessário)
  if (filters.numero_original) {
    const benchmarks = await getAllBenchmarks();
    const numeroFilter = createSearchFilter(filters.numero_original);
    const matched = new Set(
      benchmarks
        .filter(b => b.numero_original && numeroFilter(b.numero_original))
        .map(b => b.codigo)
    );
    filtered = filtered.filter(p => matched.has(p.codigo));
  }

  // Filtro por fabricante/tipo de veículo (somente se necessário)
  if (filters.fabricante || filters.tipoVeiculo) {
    const fabricanteFilter = filters.fabricante ? 
      createSearchFilter(filters.fabricante) : () => true;
    
    // Identificar conjuntos que atendem aos filtros
    const matchingConjuntos = new Set();
    
    aplicacoes.forEach(a => {
      const fabricaMatch = fabricanteFilter(a.fabricante || '');
      const tipoMatch = !filters.tipoVeiculo || matchesTipoFilter(a, filters.tipoVeiculo);
      
      if (fabricaMatch && tipoMatch) {
        matchingConjuntos.add(a.codigo_conjunto);
      }
    });

    // Filtrar produtos que são conjuntos válidos
    filtered = filtered.filter(p => matchingConjuntos.has(p.codigo));
  }

  // Paginação
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const paginated = filtered.slice(offset, offset + limit);

  const duration = Date.now() - start;

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
  const start = Date.now();

  // Carregar dados em paralelo
  const [conjuntos, products, aplicacoes] = await Promise.all([
    getAllConjuntos(),
    getAllProducts(),
    (filters.fabricante || filters.tipoVeiculo) ? getAllAplicacoes() : Promise.resolve([])
  ]);

  // Criar mapa de produtos para acesso rápido
  const productMap = new Map(products.map(p => [p.codigo, p]));

  // Agrupar conjuntos por pai
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
    // Incluir todas as peças do conjunto (sem excluir por quantidade)
    parent.children.push({
      filho: row.filho,
      filho_des: row.filho_des || null,
      qtd_explosao: row.qtd_explosao
    });
  }

  let parents = Array.from(parentsMap.values());

  // Aplicar filtros
  if (filters.fabricante || filters.tipoVeiculo) {
    const fabricanteFilter = filters.fabricante ? 
      createSearchFilter(filters.fabricante) : () => true;
    
    const matchingConjuntos = new Set();
    
    aplicacoes.forEach(a => {
      const fabricaMatch = fabricanteFilter(a.fabricante || '');
      const tipoMatch = !filters.tipoVeiculo || matchesTipoFilter(a, filters.tipoVeiculo);
      
      if (fabricaMatch && tipoMatch) {
        matchingConjuntos.add(a.codigo_conjunto);
      }
    });

    parents = parents.filter(p => matchingConjuntos.has(p.codigo));
  }

  if (filters.search) {
    const searchFilter = createSearchFilter(filters.search);
    parents = parents.filter(parent => {
      if (searchFilter(parent.codigo) || searchFilter(parent.descricao)) {
        return true;
      }
      return parent.children.some(ch =>
        searchFilter(ch.filho) || searchFilter(ch.filho_des)
      );
    });
  }

  if (filters.grupo) {
    parents = parents.filter(p => p.grupo === filters.grupo);
  }

  // Paginação
  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));
  
  const total = parents.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  const paginatedParents = parents.slice(offset, offset + limit);

  const duration = Date.now() - start;

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
  
  const searchFilter = createSearchFilter(search);
  return products.filter(p =>
    searchFilter(p.codigo) || searchFilter(p.descricao)
  );
}

export async function getProductWithConjuntos(code) {
  if (!code) return null;
  
  // Use a mesma normalização em todos os lugares
  const upCode = normalizeCodigo(code);
  // lookup conjunto
  
  const [products, conjuntos, benchmarks, aplicacoes] = await Promise.all([
    getAllProducts(),
    getAllConjuntos(),
    getAllBenchmarks(),
    getAllAplicacoes()
  ]);

  // Busque o produto com a mesma normalização
  const product = products.find(p => normalizeCodigo(p.codigo) === upCode);
  // basic counts available in caches
  if (!product) return null;

  // Corrija as comparações nos filtros também:
  const productConjuntos = conjuntos.filter(c => 
    normalizeCodigo(c.pai) === normalizeCodigo(product.codigo)
  );
  
  const productAplicacoes = aplicacoes.filter(a => 
    normalizeCodigo(a.codigo_conjunto) === normalizeCodigo(product.codigo)
  );
  
  const productBenchmarks = benchmarks.filter(b => 
    normalizeCodigo(b.codigo) === normalizeCodigo(product.codigo)
  );
  
  const memberships = conjuntos
    .filter(c => normalizeCodigo(c.filho) === normalizeCodigo(product.codigo))
    .map(c => ({ 
      codigo_conjunto: c.pai, 
      quantidade: c.qtd_explosao 
    }));

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

// ====== FILTROS E METADADOS ======
export async function getAvailableFilters() {
  const [products, benchmarks, aplicacoes] = await Promise.all([
    getAllProducts(),
    getAllBenchmarks(),
    getAllAplicacoes()
  ]);

  // Grupos
  const grupos = new Set();
  products.forEach(p => {
    if (p.grupo) grupos.add(p.grupo);
  });

  // Números originais (top 50)
  const numeros = [...new Set(
    benchmarks
      .map(b => b.numero_original)
      .filter(Boolean)
  )].slice(0, 50);

  // Tipos de veículo (siglas canônicas)
  const canonicalSet = new Set(['VLL', 'VLP', 'MLL', 'MLP']);
  const foundSiglas = new Set();
  
  aplicacoes.forEach(a => {
    if (a.sigla_tipo && canonicalSet.has(a.sigla_tipo)) {
      foundSiglas.add(a.sigla_tipo);
    }
  });

  // Fabricantes (com cache)
  const fabricantes = await getFabricantes();

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
  const [products, conjuntos] = await Promise.all([
    getAllProducts(),
    getAllConjuntos()
  ]);

  const paiUnicos = new Set(conjuntos.map(c => c.pai));

  return {
    totalProducts: products.length,
    totalConjuntos: paiUnicos.size,
    lastUpdate: new Date().toISOString(),
    cacheStatus: {
      produtos: {
        isCached: caches.produtos.data !== null,
        ageSeconds: caches.produtos.timestamp ? 
          Math.floor((Date.now() - caches.produtos.timestamp) / 1000) : null
      },
      conjuntos: {
        isCached: caches.conjuntos.data !== null,
        ageSeconds: caches.conjuntos.timestamp ? 
          Math.floor((Date.now() - caches.conjuntos.timestamp) / 1000) : null
      }
    }
  };
}

// Função auxiliar para mapear/match de tipoVeiculo
function matchesTipoFilter(aplicacao, tipoFilter) {
  if (!tipoFilter) return true;
  
  const tfRaw = String(tipoFilter || '').trim();
  const tf = tfRaw.toLowerCase();
  const tipo = (aplicacao.tipo || '').toString().toLowerCase();
  const sigla = (aplicacao.sigla_tipo || '').toString().toLowerCase();

  // Canonical siglas: VLL, VLP, MLL, MLP
  const canonical = ['vll', 'vlp', 'mll', 'mlp'];

  // Se o usuário passou uma sigla canônica, fazer match exato
  if (canonical.includes(tf)) {
    return sigla === tf;
  }

  // Leve
  if (tf === 'leve') {
    if (tipo.includes('lev')) return true;
    if (tipo.includes('linha')) return true;
    if (sigla.includes('l') && !sigla.includes('p')) return true;
    return false;
  }

  // Pesado
  if (tf === 'pesado') {
    if (tipo.includes('pesad')) return true;
    if (sigla.includes('p')) return true;
    return false;
  }

  // Caso específico
  return tipo.includes(tf) || sigla.includes(tf);
}

// Garantir existência/população da tabela fabricantes
async function ensureFabricantesPopulated() {
  // ensure fabricantes
  await query(`
    CREATE TABLE IF NOT EXISTS fabricantes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      UNIQUE KEY unq_fabricante_nome (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    INSERT IGNORE INTO fabricantes (nome)
    SELECT DISTINCT TRIM(fabricante) as nome
    FROM aplicacoes
    WHERE fabricante IS NOT NULL 
      AND TRIM(fabricante) != ''
  `);
  // ensure fabricantes complete
}

// Export helper to allow triggering seed via route
export { ensureFabricantesPopulated, matchesTipoFilter };