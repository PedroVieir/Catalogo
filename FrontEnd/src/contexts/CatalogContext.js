import { createContext, useContext, useState } from "react";

const CatalogContext = createContext();

export function CatalogProvider({ children }) {
  const [catalogState, setCatalogState] = useState({
    currentPage: 1,
    currentFilters: {
      search: "",
      grupo: "",
      subgrupo: "",
      tipo: "", // "todos", "produtos", "conjuntos"
      sortBy: "codigo" // "codigo", "descricao", "grupo"
    }
  });

  const updateCatalogState = (newState) => {
    setCatalogState(prev => ({
      ...prev,
      ...newState
    }));
  };

  return (
    <CatalogContext.Provider value={{ catalogState, updateCatalogState }}>
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
