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
            <label>Grupo</label>
            <select
              value={currentFilters.grupo || "JOGOS DE JUNTAS"}
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
            <label>Fabricante</label>
            <select
              value={currentFilters.fabricante || ""}
              onChange={(e) => onFilterChange("fabricante", e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os fabricantes</option>
              {availableFilters.fabricantes?.map(f => {
                const name = (typeof f === 'string') ? f : (f && f.name ? f.name : '');
                const count = (f && typeof f === 'object' && Number.isFinite(Number(f.count))) ? Number(f.count) : 0;
                return (
                  <option key={name} value={name}>{name}{count ? ` (${count})` : ''}</option>
                );
              })}
            </select>
          </div>

          <div className="filter-group">
            <label>Tipo de veículo</label>
            <select
              value={currentFilters.tipoVeiculo || ""}
              onChange={(e) => onFilterChange("tipoVeiculo", e.target.value)}
              className="filter-select"
            >
              <option value="">Todos os tipos</option>
              {availableFilters.vehicleTypes?.map(sigla => {
                const labelMap = {
                  VLL: 'Veículo - Linha Leve (VLL)',
                  VLP: 'Veículo - Linha Pesada (VLP)',
                  MLL: 'Motor - Linha Leve (MLL)',
                  MLP: 'Motor - Linha Pesada (MLP)'
                };
                const upper = String(sigla).toUpperCase();
                const label = labelMap[upper] || upper;
                return <option key={upper} value={upper}>{label}</option>;
              })}
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
