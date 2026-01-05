import { useCallback, useEffect, useState } from "react";

/**
 * Hook para gerenciar filtros avançados com persistência
 */
export function useAdvancedFilters(storageKey = "catalogFilters") {
  const [filters, setFilters] = useState({
    search: "",
    grupo: "",
    isConjunto: null, // null = todos, true = apenas conjuntos, false = apenas produtos simples
    sortBy: "codigo" // "codigo", "descricao", "grupo"
  });

  const [availableFilters, setAvailableFilters] = useState({
    grupos: []
  });

  // Carrega filtros do sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar filtros salvos", e);
      }
    }
  }, [storageKey]);

  // Salva filtros no sessionStorage
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(filters));
  }, [filters, storageKey]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateMultipleFilters = useCallback((newFilters) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: "",
      grupo: "",
      isConjunto: null,
      sortBy: "codigo"
    });
  }, []);

  const setAvailableOptions = useCallback((options) => {
    setAvailableFilters(options);
  }, []);

  return {
    filters,
    updateFilter,
    updateMultipleFilters,
    resetFilters,
    availableFilters,
    setAvailableOptions
  };
}

/**
 * Função utilitária para filtrar produtos em memória
 */
export function filterAndSortProducts(products, filters) {
  if (!products || products.length === 0) {
    return [];
  }

  let filtered = products;

  // Filtro por busca
  if (filters.search && filters.search.trim()) {
    const searchLower = filters.search.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      p.codigo.toLowerCase().includes(searchLower) ||
      p.descricao.toLowerCase().includes(searchLower)
    );
  }

  // Filtro por grupo
  if (filters.grupo) {
    filtered = filtered.filter((p) => p.grupo === filters.grupo);
  }

  // Filtro por tipo (conjunto ou produto simples)
  if (filters.isConjunto !== null) {
    const hasConjuntos = (p) => p.conjuntos && Array.isArray(p.conjuntos) && p.conjuntos.some((c) => c && c.filho && String(c.filho).trim() !== "");
    if (filters.isConjunto) {
      filtered = filtered.filter(hasConjuntos);
    } else {
      filtered = filtered.filter((p) => !hasConjuntos(p));
    }
  }

  // Ordenação
  if (filters.sortBy) {
    filtered = filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "descricao":
          return a.descricao.localeCompare(b.descricao);
        case "grupo":
          return a.grupo.localeCompare(b.grupo);
        case "codigo":
        default:
          return a.codigo.localeCompare(b.codigo);
      }
    });
  }

  return filtered;
}

/**
 * Extrai opções de filtro disponíveis de um array de produtos
 */
export function extractFilterOptions(products) {
  const grupos = new Set();
  products.forEach((p) => {
    if (p.grupo) grupos.add(p.grupo);
  });

  return {
    grupos: Array.from(grupos).sort()
  };
}
