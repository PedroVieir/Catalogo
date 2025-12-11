import React from "react";

// Custom close button used by react-toastify
// Recebe a função closeToast injetada pelo ToastContainer
export default function ToastCloseButton({ closeToast }) {
  return (
    <button
      type="button"
      aria-label="Fechar notificação"
      className="Toastify__close-button"
      onClick={(e) => {
        e.stopPropagation();
        if (typeof closeToast === "function") closeToast();
      }}
    >
      ×
    </button>
  );
}
