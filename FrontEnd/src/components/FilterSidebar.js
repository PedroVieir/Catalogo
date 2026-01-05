import { useEffect, useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import "../styles/FilterSidebar.css";

function FilterSidebar({
  filters,
  onFilterChange,
  availableFilters,
  loading = false
}) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.search) {
      onFilterChange("search", debouncedSearch);
    }
  }, [debouncedSearch, filters.search, onFilterChange]);

  const handleSearchChange = (e) => {
    setLocalSearch(e.target.value);
  };

  const handleFilterChange = (key, value) => {
    onFilterChange(key, value);
  };

  const handleReset = () => {
    setLocalSearch("");
    onFilterChange("search", "");
    onFilterChange("grupo", "");
    onFilterChange("isConjunto", null);
  };

  const hasActiveFilters =
    filters.search ||
    filters.grupo ||
    filters.isConjunto !== null;

  return (
    <aside className="filter-sidebar">
      <div className="filter-header">
        <h2>Filtros</h2>
        {hasActiveFilters && (
          <button
            className="filter-reset-btn"
            onClick={handleReset}
            title="Limpar todos os filtros"
            aria-label="Limpar todos os filtros"
          >
            ✕ Limpar
          </button>
        )}
      </div>

      <div className="filter-section">
        <label htmlFor="search-filter" className="filter-label">
          <span className="filter-label-text">Buscar</span>
        </label>
        <div className="search-input-wrapper">
          <input
            id="search-filter"
            type="text"
            className="filter-input"
            placeholder="Código, descrição..."
            value={localSearch}
            onChange={handleSearchChange}
            disabled={loading}
            autoComplete="off"
          />
          {localSearch && (
            <button
              className="search-clear-btn"
              onClick={() => setLocalSearch("")}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>
        <p className="filter-hint">Digite para buscar em tempo real</p>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-section">
        <label htmlFor="grupo-filter" className="filter-label">
          <span className="filter-label-text">Categoria</span>
        </label>
        <select
          id="grupo-filter"
          className="filter-select"
          value={filters.grupo}
          onChange={(e) => handleFilterChange("grupo", e.target.value)}
          disabled={loading || availableFilters.grupos.length === 0}
        >
          <option value="">Todas as categorias</option>
          {availableFilters.grupos.map((grupo) => (
            <option key={grupo} value={grupo}>
              {grupo}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-section">
        <label className="filter-label">
          <span className="filter-label-text">Tipo de Produto</span>
        </label>
        <div className="filter-checkbox-group">
          <label className="filter-checkbox-label">
            <input
              type="checkbox"
              checked={filters.isConjunto === true}
              onChange={(e) =>
                handleFilterChange("isConjunto", e.target.checked ? true : null)
              }
              disabled={loading}
            />
            <span className="filter-checkbox-text">Apenas Conjuntos</span>
          </label>
          <label className="filter-checkbox-label">
            <input
              type="checkbox"
              checked={filters.isConjunto === false}
              onChange={(e) =>
                handleFilterChange("isConjunto", e.target.checked ? false : null)
              }
              disabled={loading}
            />
            <span className="filter-checkbox-text">Apenas Produtos Simples</span>
          </label>
        </div>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-section">
        <label htmlFor="sort-filter" className="filter-label">
          <span className="filter-label-text">Ordenar por</span>
        </label>
        <select
          id="sort-filter"
          className="filter-select"
          value={filters.sortBy}
          onChange={(e) => handleFilterChange("sortBy", e.target.value)}
          disabled={loading}
        >
          <option value="codigo">Código (A-Z)</option>
          <option value="descricao">Descrição (A-Z)</option>
          <option value="grupo">Categoria (A-Z)</option>
        </select>
      </div>

      {loading && (
        <div className="filter-loading">
          <div className="spinner"></div>
          <p>Carregando filtros...</p>
        </div>
      )}
    </aside>
  );
}

export default FilterSidebar;
