import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Hook para gerenciar histórico de navegação com estado
 * Permite voltar ao estado anterior mantendo filtros e buscas
 */
export function useNavigationHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const historyRef = useRef([]);
  const [canGoBack, setCanGoBack] = useState(false);

  // Inicializa o histórico
  useEffect(() => {
    const savedHistory = sessionStorage.getItem("navigationHistory");
    if (savedHistory) {
      try {
        historyRef.current = JSON.parse(savedHistory);
      } catch (e) {
        historyRef.current = [];
      }
    }

    // Adiciona a navegação atual ao histórico
    const currentState = {
      path: location.pathname + location.search,
      state: location.state || {},
      timestamp: Date.now()
    };

    // Evita duplicatas consecutivas
    if (
      historyRef.current.length === 0 ||
      historyRef.current[historyRef.current.length - 1].path !== currentState.path
    ) {
      historyRef.current.push(currentState);
      // Limita o histórico a 50 entradas
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      }
      sessionStorage.setItem("navigationHistory", JSON.stringify(historyRef.current));
    }

    setCanGoBack(historyRef.current.length > 1);
  }, [location]);

  const goBack = useCallback(() => {
    if (historyRef.current.length > 1) {
      // Remove a navegação atual
      historyRef.current.pop();
      const previousState = historyRef.current[historyRef.current.length - 1];

      if (previousState) {
        sessionStorage.setItem("navigationHistory", JSON.stringify(historyRef.current));
        navigate(previousState.path, { state: previousState.state, replace: true });
      }
    }
  }, [navigate]);

  const pushState = useCallback(
    (path, state = {}) => {
      navigate(path, { state, replace: false });
    },
    [navigate]
  );

  return {
    canGoBack,
    goBack,
    pushState,
    history: historyRef.current
  };
}
