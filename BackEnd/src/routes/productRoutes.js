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

const router = Router();

// ====== FILTROS E METADADOS ======
router.get("/filters", listFilters);        // Filtros disponíveis
router.get("/status", getCatalogStatus);    // Status e estatísticas

// ====== PRODUTOS ======
router.get("/products", listProducts);              // Compatibilidade anterior
router.get("/products/paginated", listProductsPaginated); // Com paginação
router.get("/products/:code", getProductDetails);   // Detalhes do produto

// ====== CONJUNTOS ======
router.get("/conjuntos/paginated", listConjuntosPaginated); // Lista com paginação
router.get("/conjuntos/:code", getConjuntoDetails);         // Detalhes do conjunto

export default router;
