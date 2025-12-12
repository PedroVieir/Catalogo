import React, { useState, useEffect } from "react";
import "../styles/ImageLightbox.css";

/**
 * ImageLightbox: displays image in a centered modal with zoom capability
 * Click outside to close, use wheel/pinch to zoom, ESC to close
 */
export default function ImageLightbox({ isOpen, imageSrc, alt, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.max(1, Math.min(prev - delta, 4)));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="lightbox-backdrop"
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
    >
      <div className="lightbox-container">
        <button
          className="lightbox-close"
          onClick={onClose}
          aria-label="Fechar visualizador (ESC)"
          title="Fechar (ESC)"
        >
          ×
        </button>

        <div className="lightbox-controls">
          <div className="zoom-info">{Math.round(zoom * 100)}%</div>
          <div className="zoom-buttons">
            <button
              className="zoom-btn"
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              title="Diminuir zoom"
            >
              −
            </button>
            <button
              className="zoom-btn"
              onClick={resetZoom}
              title="Resetar zoom"
            >
              ⟲
            </button>
            <button
              className="zoom-btn"
              onClick={() => setZoom((prev) => Math.min(prev + 0.2, 4))}
              title="Aumentar zoom"
            >
              +
            </button>
          </div>
        </div>

        <div
          className="lightbox-content"
          onMouseDown={handleMouseDown}
          style={{ cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default" }}
        >
          <img
            src={imageSrc}
            alt={alt}
            className="lightbox-image"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              cursor: isDragging ? "grabbing" : zoom > 1 ? "grab" : "default"
            }}
            draggable={false}
          />
        </div>

        <div className="lightbox-info">
          Roda do mouse para zoom | Arraste para mover | ESC ou clique fora para fechar
        </div>
      </div>
    </div>
  );
}
