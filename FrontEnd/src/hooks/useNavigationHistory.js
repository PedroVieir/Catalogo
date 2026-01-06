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
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializa o histórico apenas uma vez
  useEffect(() => {
    if (isInitialized) return;

    const savedHistory = sessionStorage.getItem("navigationHistory");
    if (savedHistory) {
      try {
        historyRef.current = JSON.parse(savedHistory);
      } catch (e) {
        historyRef.current = [];
      }
    }

    setIsInitialized(true);
  }, [isInitialized]);

  // Adiciona navegação ao histórico quando a localização muda
  useEffect(() => {
    if (!isInitialized) return;

    // eslint-disable-next-line no-restricted-globals
    const currentPath = location.pathname + location.search;
    // eslint-disable-next-line no-restricted-globals
    const currentState = {
      path: currentPath,
      state: location.state || {},
      timestamp: Date.now()
    };

    // Verifica se já existe uma entrada idêntica no final do histórico
    const lastEntry = historyRef.current[historyRef.current.length - 1];
    if (!lastEntry || lastEntry.path !== currentPath) {
      historyRef.current.push(currentState);

      // Limita o histórico a 50 entradas
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      }

      sessionStorage.setItem("navigationHistory", JSON.stringify(historyRef.current));
    }

    setCanGoBack(historyRef.current.length > 1);
  }, [location, isInitialized]);

  const goBack = useCallback(() => {
    if (historyRef.current.length > 1) {
      // Remove a entrada atual (página onde estamos)
      historyRef.current.pop();

      // Pega a entrada anterior
      const previousEntry = historyRef.current[historyRef.current.length - 1];

      if (previousEntry) {
        // Salva o histórico atualizado
        sessionStorage.setItem("navigationHistory", JSON.stringify(historyRef.current));

        // Navega para a entrada anterior
        navigate(previousEntry.path, {
          state: previousEntry.state,
          replace: true
        });

        return true;
      }
    }

    return false;
  }, [navigate]);

  const pushState = useCallback(
    (path, state = {}) => {
      const newEntry = {
        path,
        state,
        timestamp: Date.now()
      };

      historyRef.current.push(newEntry);

      // Limita o histórico
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      }

      sessionStorage.setItem("navigationHistory", JSON.stringify(historyRef.current));
      navigate(path, { state, replace: false });
    },
    [navigate]
  );

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    sessionStorage.removeItem("navigationHistory");
    setCanGoBack(false);
  }, []);

  return {
    canGoBack,
    goBack,
    pushState,
    clearHistory,
    history: historyRef.current,
    currentPath: location.pathname + location.search
  };
}
