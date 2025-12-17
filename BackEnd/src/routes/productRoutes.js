import { Router } from "express";
import { 
  listProducts, 
  listProductsPaginated,
  getProductDetails, 
  listConjuntosPaginated,
  getConjuntoDetails, 
  listFilters,
  getCatalogStatus
} from "../controllers/productController.js";
import { ensureFabricantesPopulated } from "../services/productService.js";
import { reloadCatalog } from "../services/productService.js";

const router = Router();
// ====== FILTROS E METADADOS ======
router.get("/filters", listFilters);        // Filtros disponíveis
// Endpoint explícito para forçar população/seed de fabricantes
router.post("/filters/seed-fabricantes", async (req, res, next) => {
  try {
    await ensureFabricantesPopulated();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
router.get("/status", getCatalogStatus);    // Status e estatísticas
// Forçar reload do catálogo (invalida cache e recarrega)
router.post("/status/refresh", async (req, res, next) => {
  try {
    await reloadCatalog();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ====== PRODUTOS ======
router.get("/products", listProducts);              // Compatibilidade anterior
router.get("/products/paginated", listProductsPaginated); // Com paginação
router.get("/products/:code", getProductDetails);   // Detalhes do produto

// ====== CONJUNTOS ======
router.get("/conjuntos/paginated", listConjuntosPaginated); // Lista com paginação
router.get("/conjuntos/:code", getConjuntoDetails);         // Detalhes do conjunto

export default router;
