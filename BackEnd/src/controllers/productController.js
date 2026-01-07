import Joi from "joi";
import {
  searchProducts,
  getProductWithConjuntos,
  getConjuntoWithProducts,
  getCatalogSnapshot,
  getAvailableFilters,
  getProductsPaginated,
  getProductsPaginatedOptimized,
  getConjuntosPaginated,
  getCatalogStats
} from "../services/products/productService.js";

// Schemas de validação
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

const filtersSchema = Joi.object({
  search: Joi.string().trim().max(100).allow(''),
  grupo: Joi.string().trim().max(50).allow(''),
  fabricante: Joi.string().trim().max(50).allow(''),
  tipoVeiculo: Joi.string().trim().max(50).allow(''),
  numero_original: Joi.string().trim().max(50).allow(''),
  sortBy: Joi.string().valid('codigo', 'nome', 'fabricante', 'grupo').default('codigo')
});

const productCodeSchema = Joi.object({
  code: Joi.string().trim().max(50).required()
});

// Função helper para validar
const validateQuery = (schema, data) => {
  const { error, value } = schema.validate(data, { stripUnknown: true });
  if (error) {
    throw new Error(`Parâmetros inválidos: ${error.details.map(d => d.message).join(', ')}`);
  }
  return value;
};

// ====== PRODUTOS ======

export async function listProducts(req, res, next) {
  try {
    const search = req.query.search || "";
    const products = await searchProducts(search);
    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function listProductsPaginated(req, res, next) {
  try {
    const { page, limit } = validateQuery(paginationSchema, req.query);
    const filters = validateQuery(filtersSchema, req.query);

    const result = await getProductsPaginated(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listProductsPaginatedOptimized(req, res, next) {
  try {
    const { page, limit } = validateQuery(paginationSchema, req.query);
    const filters = validateQuery(filtersSchema, req.query);

    const result = await getProductsPaginatedOptimized(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProductDetails(req, res, next) {
  try {
    const { code } = validateQuery(productCodeSchema, req.params);
    const result = await getProductWithConjuntos(code);

    if (!result) {
      return res.status(404).json({ error: "Produto não encontrado" });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ====== CONJUNTOS ======

export async function listConjuntosPaginated(req, res, next) {
  try {
    const { page, limit } = validateQuery(paginationSchema, req.query);
    const filters = validateQuery(filtersSchema, req.query);

    const result = await getConjuntosPaginated(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getConjuntoDetails(req, res, next) {
  try {
    const { code } = validateQuery(productCodeSchema, req.params);
    const result = await getConjuntoWithProducts(code);

    if (!result) {
      return res.status(404).json({ error: "Conjunto não encontrado" });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function getCatalogSnapshotController(req, res, next) {
  try {
    const snapshot = await getCatalogSnapshot();
    res.json({ data: snapshot });
  } catch (err) {
    next(err);
  }
}

// ====== FILTROS E METADADOS ======

export async function listFilters(req, res, next) {
  try {
    const filters = await getAvailableFilters();
    // retornar objeto diretamente para compatibilidade com frontend
    res.json(filters);
  } catch (err) {
    next(err);
  }
}

export async function getCatalogStatus(req, res, next) {
  try {
    const stats = await getCatalogStats();
    // retornar estatísticas com chaves esperadas pelo frontend
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
