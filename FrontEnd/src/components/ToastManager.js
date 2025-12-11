import React, { useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";

// ToastManager: envolve ToastContainer e adiciona um fallback
// para garantir que o clique no botão de fechar remova a notificação.
export default function ToastManager(props) {
  useEffect(() => {
    const onDocClick = (e) => {
      try {
        const btn = e.target.closest && e.target.closest(".Toastify__close-button");
        if (btn) {
          // fallback: fechar todas as toasts (library normalmente fecha apenas a tocada)
          toast.dismiss();
        }
      } catch (err) {
        // silencioso
      }
    };

    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      {...props}
    />
  );
}
