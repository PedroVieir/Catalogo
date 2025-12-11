const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:4000/api";

// Timeout padrão para requisições (ms)
const REQUEST_TIMEOUT = 15000;

// Cache simples em memória com validação
const cache = {
  products: null,
  conjuntos: null,
  filters: null,
  status: null,
  timestamp: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function isCacheValid() {
  return Date.now() - cache.timestamp < CACHE_DURATION;
}

function invalidateCache() {
  cache.products = null;
  cache.conjuntos = null;
  cache.filters = null;
  cache.status = null;
  cache.timestamp = 0;
}

// ====== FUNÇÕES DE UTILIDADE ======

/**
 * Executa fetch com timeout
 * @param {string} url - URL da requisição
 * @param {Object} options - Opções do fetch
 * @returns {Promise<Response>}
 */
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

/**
 * Faz requisição com retry automático para erros transitórios
 * @param {string} url - URL da requisição
 * @param {Object} options - Opções do fetch
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 2)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // Se for erro de conexão (503, 504) e temos tentativas, retry
      if ((response.status === 503 || response.status === 504) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500; // Backoff: 500ms, 1000ms, 2000ms
        console.warn(
          `Erro ${response.status}. Tentativa ${attempt + 1}/${maxRetries + 1}. ` +
          `Aguardando ${delay}ms antes de retry...`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue; // Tenta novamente
      }

      return response; // Sucesso ou erro não-transitório
    } catch (error) {
      lastError = error;

      // Se for erro de rede e temos tentativas, retry
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(
          `Erro de rede: ${error.message}. Tentativa ${attempt + 1}/${maxRetries + 1}. ` +
          `Aguardando ${delay}ms antes de retry...`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue; // Tenta novamente
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  throw lastError;
}

/**
 * Trata resposta com validação de dados
 * Com suporte a retry para erros de conexão (503, 504)
 * @param {Response} response
 * @param {number} retryCount - Tentativas restantes para retry
 * @returns {Promise<Object>}
 */
async function handleResponse(response, retryCount = 1) {
  // Validar resposta básica
  if (!response) {
    throw new Error("Resposta do servidor inválida");
  }

  // Tentar fazer parse do JSON
  let body = {};
  try {
    body = await response.json();
  } catch (e) {
    // Se não conseguir fazer parse, tentar com texto
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${text.substring(0, 100)}`);
    }
    return null; // Resposta vazia é válida (204 No Content)
  }

  // Validar status HTTP
  if (!response.ok) {
    // Se for erro de conexão/timeout e temos retries, aguardar e retry
    if ((response.status === 503 || response.status === 504) && retryCount > 0) {
      const delay = 1000 + Math.random() * 1000; // Delay entre 1s e 2s
      console.warn(
        `Erro ${response.status} (${body.error}). Aguardando ${Math.round(delay)}ms para retry...`
      );
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // Nota: Não podemos fazer retry aqui, pois não temos a URL
      // O retry será feito na função que chama handleResponse
      throw new Error(body.error || `Erro HTTP ${response.status}`);
    }

    throw new Error(
      body.error || `Erro HTTP ${response.status}`
    );
  }

  // Validar que recebemos um objeto
  if (typeof body !== "object" || body === null) {
    throw new Error("Resposta do servidor não é um objeto JSON válido");
  }

  return body;
}

/**
 * Valida parâmetros comuns
 * @param {Object} params
 */
function validateParams(params) {
  const { page = 1, limit = 20 } = params;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Página deve ser um número inteiro maior que 0");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Limite deve ser um número entre 1 e 100");
  }

  return { page, limit };
}

// ====== FUNÇÕES DE REQUISIÇÃO COM PROGRAMAÇÃO DEFENSIVA ======

/**
 * Busca todos os produtos com busca opcional
 * @param {string} search
 * @returns {Promise<Array>}
 */
export async function fetchProducts(search = "") {
  try {
    const url = new URL(`${API_BASE_URL}/products`);

    // Validar e sanitizar busca
    if (search && typeof search === "string") {
      url.searchParams.set("search", search.trim().substring(0, 100));
    }

    const response = await fetchWithRetry(url.toString());
    const data = await handleResponse(response);

    // Validar resposta
    if (!Array.isArray(data)) {
      console.warn("Resposta não é um array, retornando array vazio");
      return [];
    }

    return data;
  } catch (error) {
    console.error("Erro ao buscar produtos:", error.message);
    throw new Error(`Falha ao carregar produtos: ${error.message}`);
  }
}

/**
 * Busca produtos com paginação
 * @param {number} page
 * @param {number} limit
 * @param {Object} filters
 * @returns {Promise<Object>}
 */
export async function fetchProductsPaginated(page = 1, limit = 20, filters = {}) {
  try {
    // Validar parâmetros
    const { page: validPage, limit: validLimit } = validateParams({ page, limit });

    const url = new URL(`${API_BASE_URL}/products/paginated`);
    url.searchParams.set("page", validPage);
    url.searchParams.set("limit", validLimit);

    // Adicionar filtros com validação
    if (filters.search && typeof filters.search === "string") {
      url.searchParams.set("search", filters.search.trim().substring(0, 100));
    }
    if (filters.grupo && typeof filters.grupo === "string") {
      url.searchParams.set("grupo", filters.grupo.trim().substring(0, 50));
    }
    if (filters.subgrupo && typeof filters.subgrupo === "string") {
      url.searchParams.set("subgrupo", filters.subgrupo.trim().substring(0, 50));
    }
    if (filters.sortBy && typeof filters.sortBy === "string") {
      url.searchParams.set("sortBy", filters.sortBy.substring(0, 50));
    }

    const response = await fetchWithRetry(url.toString());
    const data = await handleResponse(response);

    // Validar estrutura da resposta
    if (!data || typeof data !== "object") {
      throw new Error("Estrutura de resposta inválida");
    }

    return {
      data: Array.isArray(data.data) ? data.data : [],
      pagination: {
        page: parseInt(data.pagination?.page) || 1,
        limit: parseInt(data.pagination?.limit) || limit,
        total: parseInt(data.pagination?.total) || 0,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar produtos paginados:", error.message);
    throw new Error(`Falha ao carregar produtos: ${error.message}`);
  }
}

/**
 * Busca conjuntos com paginação
 * @param {number} page
 * @param {number} limit
 * @param {Object} filters
 * @returns {Promise<Object>}
 */
export async function fetchConjuntosPaginated(page = 1, limit = 20, filters = {}) {
  try {
    // Validar parâmetros
    const { page: validPage, limit: validLimit } = validateParams({ page, limit });

    const url = new URL(`${API_BASE_URL}/conjuntos/paginated`);
    url.searchParams.set("page", validPage);
    url.searchParams.set("limit", validLimit);

    // Adicionar filtros com validação
    if (filters.search && typeof filters.search === "string") {
      url.searchParams.set("search", filters.search.trim().substring(0, 100));
    }
    if (filters.grupo && typeof filters.grupo === "string") {
      url.searchParams.set("grupo", filters.grupo.trim().substring(0, 50));
    }
    if (filters.sortBy && typeof filters.sortBy === "string") {
      url.searchParams.set("sortBy", filters.sortBy.substring(0, 50));
    }

    const response = await fetchWithRetry(url.toString());
    const data = await handleResponse(response);

    // Validar estrutura da resposta
    if (!data || typeof data !== "object") {
      throw new Error("Estrutura de resposta inválida");
    }

    return {
      data: Array.isArray(data.data) ? data.data : [],
      pagination: {
        page: parseInt(data.pagination?.page) || 1,
        limit: parseInt(data.pagination?.limit) || limit,
        total: parseInt(data.pagination?.total) || 0,
      },
    };
  } catch (error) {
    console.error("Erro ao buscar conjuntos paginados:", error.message);
    throw new Error(`Falha ao carregar conjuntos: ${error.message}`);
  }
}

/**
 * Busca detalhes de um produto
 * @param {string} code - Código do produto
 * @returns {Promise<Object>}
 */
export async function fetchProductDetails(code) {
  try {
    // Validação rigorosa do código
    if (!code || typeof code !== "string") {
      throw new Error("Código do produto é obrigatório e deve ser texto");
    }

    const cleanCode = code.trim().substring(0, 50);
    if (cleanCode.length === 0) {
      throw new Error("Código do produto não pode estar vazio");
    }

    const response = await fetchWithRetry(
      `${API_BASE_URL}/products/${encodeURIComponent(cleanCode)}`
    );
    const data = await handleResponse(response);

    // Validar que recebemos um objeto
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Dados do produto inválidos");
    }

    return data;
  } catch (error) {
    console.error("Erro ao buscar detalhes do produto:", error.message);
    throw new Error(`Falha ao carregar detalhes do produto: ${error.message}`);
  }
}

/**
 * Busca detalhes de um conjunto
 * @param {string} code - Código do conjunto
 * @returns {Promise<Object>}
 */
export async function fetchConjuntoDetails(code) {
  try {
    // Validação rigorosa do código
    if (!code || typeof code !== "string") {
      throw new Error("Código do conjunto é obrigatório e deve ser texto");
    }

    const cleanCode = code.trim().substring(0, 50);
    if (cleanCode.length === 0) {
      throw new Error("Código do conjunto não pode estar vazio");
    }

    const response = await fetchWithRetry(
      `${API_BASE_URL}/conjuntos/${encodeURIComponent(cleanCode)}`
    );
    const data = await handleResponse(response);

    // Validar que recebemos um objeto
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Dados do conjunto inválidos");
    }

    return data;
  } catch (error) {
    console.error("Erro ao buscar detalhes do conjunto:", error.message);
    throw new Error(`Falha ao carregar detalhes do conjunto: ${error.message}`);
  }
}

/**
 * Busca filtros disponíveis
 * @returns {Promise<Object>}
 */
export async function fetchFilters() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/filters`);
    const data = await handleResponse(response);

    // Validar estrutura
    if (!data || typeof data !== "object") {
      return { grupos: [], subgrupos: [], tipos: [] };
    }

    return {
      grupos: Array.isArray(data.grupos) ? data.grupos : [],
      subgrupos: Array.isArray(data.subgrupos) ? data.subgrupos : [],
      tipos: Array.isArray(data.tipos) ? data.tipos : [],
    };
  } catch (error) {
    console.error("Erro ao buscar filtros:", error.message);
    // Retornar estrutura vazia em caso de erro
    return { grupos: [], subgrupos: [], tipos: [] };
  }
}

/**
 * Busca status do catálogo
 * @returns {Promise<Object>}
 */
export async function fetchCatalogStatus() {
  try {
    const response = await fetchWithRetry(`${API_BASE_URL}/status`);
    const data = await handleResponse(response);

    // Validar estrutura mínima
    if (!data || typeof data !== "object") {
      return { totalProducts: 0, totalConjuntos: 0, lastUpdate: null };
    }

    return {
      totalProducts: parseInt(data.totalProducts) || 0,
      totalConjuntos: parseInt(data.totalConjuntos) || 0,
      lastUpdate: data.lastUpdate || null,
    };
  } catch (error) {
    console.error("Erro ao buscar status do catálogo:", error.message);
    return { totalProducts: 0, totalConjuntos: 0, lastUpdate: null };
  }
}
