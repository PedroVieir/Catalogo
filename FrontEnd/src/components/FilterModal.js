import React from "react";
import "../styles/FilterModal.css";

function FilterModal({ isOpen, onClose, currentFilters, onFilterChange, availableFilters, onResetFilters }) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="filter-modal-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="filter-modal">
        <div className="filter-modal-header">
          <h2>Filtros</h2>
          <button 
            className="filter-modal-close" 
            onClick={onClose}
            aria-label="Fechar filtros"
          >
            ✕
          </button>
        </div>

        <div className="filter-modal-content">
          <div className="filter-group">
            <label>Busca por Nome/Código</label>
            <input
              type="text"
              placeholder="Digite para buscar..."
              value={currentFilters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Tipo</label>
            <select
              value={currentFilters.tipo}
              onChange={(e) => onFilterChange("tipo", e.target.value)}
              className="filter-select"
            >
              <option value="">Todos</option>
              <option value="produtos">Apenas Produtos</option>
              <option value="conjuntos">Apenas Conjuntos</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Grupo</label>
            <select
              value={currentFilters.grupo}
              onChange={(e) => onFilterChange("grupo", e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os grupos</option>
              {availableFilters.grupos?.map(grupo => (
                <option key={grupo} value={grupo}>{grupo}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Subgrupo</label>
            <select
              value={currentFilters.subgrupo}
              onChange={(e) => onFilterChange("subgrupo", e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os subgrupos</option>
              {availableFilters.subgrupos?.map(subgrupo => (
                <option key={subgrupo} value={subgrupo}>{subgrupo}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Ordenar Por</label>
            <select
              value={currentFilters.sortBy}
              onChange={(e) => onFilterChange("sortBy", e.target.value)}
              className="filter-select"
            >
              <option value="codigo">Código</option>
              <option value="descricao">Descrição (A-Z)</option>
              <option value="grupo">Categoria (A-Z)</option>
            </select>
          </div>
        </div>

        <div className="filter-modal-footer">
          <button
            onClick={onResetFilters}
            className="filter-modal-reset"
          >
            Limpar Filtros
          </button>
          <button
            onClick={onClose}
            className="filter-modal-apply"
          >
            Aplicar
          </button>
        </div>
      </div>
    </>
  );
}

export default FilterModal;
