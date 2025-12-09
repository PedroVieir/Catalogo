import { 
  searchProducts, 
  getProductWithConjuntos, 
  getConjuntoWithProducts, 
  getAvailableFilters,
  getProductsPaginated,
  getConjuntosPaginated,
  getCatalogStats
} from "../services/productService.js";

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
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const filters = {
      search: req.query.search || "",
      grupo: req.query.grupo || "",
      subgrupo: req.query.subgrupo || ""
    };

    const result = await getProductsPaginated(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProductDetails(req, res, next) {
  try {
    const { code } = req.params;
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
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const filters = {
      search: req.query.search || "",
      grupo: req.query.grupo || ""
    };

    const result = await getConjuntosPaginated(page, limit, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getConjuntoDetails(req, res, next) {
  try {
    const { code } = req.params;
    const result = await getConjuntoWithProducts(code);

    if (!result) {
      return res.status(404).json({ error: "Conjunto não encontrado" });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// ====== FILTROS E METADADOS ======

export async function listFilters(req, res, next) {
  try {
    const filters = await getAvailableFilters();
    res.json({ data: filters });
  } catch (err) {
    next(err);
  }
}

export async function getCatalogStatus(req, res, next) {
  try {
    const stats = await getCatalogStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
