import { createContext, useContext, useState, useEffect } from "react";
import { fetchCatalogSnapshot, fetchFilters } from "../services/productService";

const CatalogContext = createContext();

export function CatalogProvider({ children }) {
  const [catalogState, setCatalogState] = useState({
    currentPage: 1,
    currentFilters: {
      search: "",
      grupo: "", // Default to all groups
      fabricante: "",
      tipoVeiculo: "",
      sortBy: "codigo" // "codigo", "descricao", "grupo"
    }
  });

  // Snapshot preloaded once on app start
  const [preloadState, setPreloadState] = useState({
    loaded: false,
    loading: false,
    snapshot: null,
    loadedAt: null,
    availableFilters: { grupos: [], fabricantes: [], vehicleTypes: [] }
  });

  // Cache for loaded products to avoid redundant API calls
  const [productsCache, setProductsCache] = useState(new Map());

  // Loading state for filters
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function doPreload() {
      console.log('CatalogContext: Starting preload');
      try {
        setPreloadState(s => ({ ...s, loading: true }));
        const snapshot = await fetchCatalogSnapshot();
        console.log('CatalogContext: Snapshot fetched:', snapshot ? 'success' : 'null');

        if (cancelled) return;

        // Derive grupos from products if not provided by backend
        const products = Array.isArray(snapshot.products) ? snapshot.products : [];
        const gruposSet = new Set();
        products.forEach(p => {
          if (p.grupo) gruposSet.add(p.grupo);
        });

        const fabricantes = Array.isArray(snapshot.fabricantes) ? snapshot.fabricantes : [];
        const vehicleTypesSet = new Set((Array.isArray(snapshot.aplicacoes) ? snapshot.aplicacoes : []).map(a => (a.tipo || a.tipoVeiculo || a.veiculo || '').toString().trim()).filter(Boolean));

        const availableFilters = {
          grupos: Array.from(gruposSet).sort(),
          fabricantes: fabricantes,
          vehicleTypes: vehicleTypesSet.size ? Array.from(vehicleTypesSet) : ['Leve', 'Pesado']
        };

        setPreloadState({
          loaded: true,
          loading: false,
          snapshot,
          loadedAt: Date.now(),
          availableFilters
        });

        // Add products to cache
        addToProductsCache(products);
        console.log('CatalogContext: Added', products.length, 'products to cache');

        setFiltersLoading(false);
        if (process.env.NODE_ENV === 'development') {
          console.info('CatalogContext: snapshot preloaded', {
            products: Array.isArray(snapshot.products) ? snapshot.products.length : 0,
            conjuntos: Array.isArray(snapshot.conjuntos) ? snapshot.conjuntos.length : 0
          });
        }

        // Pre-establish filters in catalogState only if they are empty defaults
        setCatalogState(prev => ({
          ...prev,
          currentFilters: {
            ...prev.currentFilters,
            // keep existing values if any, else try to set sensible defaults
            fabricante: prev.currentFilters.fabricante || (availableFilters.fabricantes[0] ? availableFilters.fabricantes[0].name || availableFilters.fabricantes[0] : ''),
            tipoVeiculo: prev.currentFilters.tipoVeiculo || ''
          }
        }));
      } catch (err) {
        console.warn('Catalog preload failed (ignored):', err.message || err);
        setPreloadState(s => ({ ...s, loading: false }));
        // Fallback: try to load filters separately
        try {
          const filters = await fetchFilters();
          setPreloadState(s => ({ ...s, availableFilters: filters || { grupos: [], fabricantes: [], vehicleTypes: [] } }));
        } catch (fallbackErr) {
          console.warn('Filters fallback failed:', fallbackErr.message || fallbackErr);
        }
        setFiltersLoading(false);
      }
    }

    doPreload();
    return () => { cancelled = true; };
  }, []);

  const updateCatalogState = (newState) => {
    setCatalogState(prev => ({
      ...prev,
      ...newState
    }));
  };

  // Function to add products to cache
  const addToProductsCache = (products) => {
    setProductsCache(prev => {
      const newCache = new Map(prev);
      products.forEach(product => {
        const code = String(product.codigo || product.code || product.id || '').toUpperCase().replace(/\s+/g, '').trim();
        if (code) newCache.set(code, product);
      });
      return newCache;
    });
  };

  // Function to get product from cache
  const getFromProductsCache = (code) => {
    const normalizedCode = String(code || '').toUpperCase().replace(/\s+/g, '').trim();
    return productsCache.get(normalizedCode);
  };

  return (
    <CatalogContext.Provider value={{
      catalogState,
      updateCatalogState,
      preloadState,
      setPreloadState,
      productsCache,
      addToProductsCache,
      getFromProductsCache,
      filtersLoading
    }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalogState() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalogState deve ser usado dentro de CatalogProvider");
  }
  return context;
}
