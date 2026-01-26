// src/contexts/NavigationContext.js
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NavigationContext = createContext();

const NAVIGATION_STORAGE_KEY = 'product_navigation_history';
const MAX_HISTORY_ITEMS = 50;
const NAVIGATION_DEBOUNCE_MS = 300;

// Tipos de ações
const actionTypes = {
    PUSH: 'PUSH',
    POP: 'POP',
    REPLACE: 'REPLACE',
    CLEAR: 'CLEAR',
    SYNC_FROM_STORAGE: 'SYNC_FROM_STORAGE',
    UPDATE_CURRENT: 'UPDATE_CURRENT'
};

// Estado inicial
const initialState = {
    history: [],
    currentIndex: -1,
    canGoBack: false,
    canGoForward: false,
    lastNavigation: null,
    navigationStack: [], // Pilha adicional para controle de loops
    isLoading: false
};

// Reducer
function navigationReducer(state, action) {
    switch (action.type) {
        case actionTypes.PUSH: {
            const { path, state: routeState, timestamp } = action.payload;

            // Verifica se já existe no histórico (evita duplicatas consecutivas)
            const isDuplicate = state.history.length > 0 &&
                state.history[state.history.length - 1].path === path;

            if (isDuplicate) {
                return {
                    ...state,
                    currentIndex: state.history.length - 1,
                    lastNavigation: { path, timestamp, type: 'PUSH' }
                };
            }

            // Remove entradas após o índice atual (se não estiver no fim)
            const newHistory = state.history.slice(0, state.currentIndex + 1);
            newHistory.push({ path, state: routeState, timestamp });

            // Limita o tamanho do histórico
            const trimmedHistory = newHistory.length > MAX_HISTORY_ITEMS
                ? newHistory.slice(-MAX_HISTORY_ITEMS)
                : newHistory;

            const newCurrentIndex = trimmedHistory.length - 1;

            // Atualiza pilha de produtos para prevenir loops
            let newNavigationStack = [...state.navigationStack];
            if (path.startsWith('/produtos/')) {
                const productCode = path.split('/produtos/')[1];
                // Remove se já existe para evitar loops
                newNavigationStack = newNavigationStack.filter(code => code !== productCode);
                newNavigationStack.push(productCode);

                // Limita a pilha de navegação
                if (newNavigationStack.length > 10) {
                    newNavigationStack = newNavigationStack.slice(-10);
                }
            }

            return {
                ...state,
                history: trimmedHistory,
                currentIndex: newCurrentIndex,
                canGoBack: newCurrentIndex > 0,
                canGoForward: false,
                lastNavigation: { path, timestamp, type: 'PUSH' },
                navigationStack: newNavigationStack
            };
        }

        case actionTypes.POP: {
            if (state.currentIndex <= 0) return state;

            const newIndex = state.currentIndex - 1;
            const poppedPath = state.history[newIndex]?.path;

            return {
                ...state,
                currentIndex: newIndex,
                canGoBack: newIndex > 0,
                canGoForward: state.currentIndex < state.history.length - 1,
                lastNavigation: {
                    path: poppedPath,
                    timestamp: Date.now(),
                    type: 'POP'
                },
                // Mantém a pilha como está no POP (a lógica de loop é tratada no PUSH)
                navigationStack: state.navigationStack
            };
        }

        case actionTypes.REPLACE: {
            const { path, state: routeState, timestamp } = action.payload;

            const newHistory = [...state.history];
            if (newHistory.length > 0 && state.currentIndex >= 0) {
                newHistory[state.currentIndex] = { path, state: routeState, timestamp };
            }

            return {
                ...state,
                history: newHistory,
                lastNavigation: { path, timestamp, type: 'REPLACE' }
            };
        }

        case actionTypes.CLEAR: {
            return {
                ...initialState,
                lastNavigation: { type: 'CLEAR', timestamp: Date.now() }
            };
        }

        case actionTypes.SYNC_FROM_STORAGE: {
            const { history, currentIndex } = action.payload;
            return {
                ...state,
                history,
                currentIndex,
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1
            };
        }

        case actionTypes.UPDATE_CURRENT: {
            const { path, state: routeState } = action.payload;

            // Verifica se a rota atual já está no histórico
            const existingIndex = state.history.findIndex(item => item.path === path);

            if (existingIndex >= 0) {
                // Atualiza o estado da rota existente
                const newHistory = [...state.history];
                newHistory[existingIndex] = {
                    ...newHistory[existingIndex],
                    state: routeState
                };

                return {
                    ...state,
                    history: newHistory,
                    currentIndex: existingIndex,
                    canGoBack: existingIndex > 0,
                    canGoForward: existingIndex < newHistory.length - 1
                };
            }

            return state;
        }

        default:
            return state;
    }
}

export function NavigationProvider({ children }) {
    const [state, dispatch] = useReducer(navigationReducer, initialState);
    const navigate = useNavigate();
    const location = useLocation();
    const lastNavigationRef = useRef(null);
    const isInitialMount = useRef(true);

    // Limpa localStorage no mount inicial se estiver corrompido
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(NAVIGATION_STORAGE_KEY);
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                // Se o histórico tem menos de 2 items ou a data é muito antiga, limpa
                const isTooOld = parsed.timestamp && (Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000);
                const isCorrupted = !Array.isArray(parsed.history) || parsed.history.length === 0;

                if (isCorrupted || isTooOld) {
                    console.log('[Navigation] Limpando histórico corrompido ou desatualizado');
                    localStorage.removeItem(NAVIGATION_STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error('[Navigation] Erro ao validar histórico:', error);
            localStorage.removeItem(NAVIGATION_STORAGE_KEY);
        }
    }, []);

    // Carrega histórico do localStorage apenas se for válido e não houver produtos com erro
    useEffect(() => {
        try {
            const savedHistory = localStorage.getItem(NAVIGATION_STORAGE_KEY);
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                let validHistory = Array.isArray(parsed.history) ? parsed.history : [];

                // Limpa histórico corrompido: remove entradas de produtos que não deveriam estar lá
                // (ex: produtos de teste que ficaram salvos)
                validHistory = validHistory.filter(item => {
                    // Aceita apenas rotas válidas e conhecidas
                    return item && item.path && (
                        item.path === '/' ||
                        item.path.startsWith('/produtos/') ||
                        item.path.startsWith('/catalogo')
                    );
                });

                // Se o histórico ficou vazio após limpeza, começa fresco
                if (validHistory.length === 0) {
                    localStorage.removeItem(NAVIGATION_STORAGE_KEY);
                    return;
                }

                const currentIdx = Math.max(
                    -1,
                    Math.min(parsed.currentIndex || -1, validHistory.length - 1)
                );

                dispatch({
                    type: actionTypes.SYNC_FROM_STORAGE,
                    payload: { history: validHistory, currentIndex: currentIdx }
                });
            }
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            // Limpa localStorage corrompido
            localStorage.removeItem(NAVIGATION_STORAGE_KEY);
        }
    }, []);

    // Salva histórico no localStorage
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        try {
            const historyToSave = {
                history: state.history,
                currentIndex: state.currentIndex,
                timestamp: Date.now()
            };
            localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(historyToSave));
        } catch (error) {
            console.error('Erro ao salvar histórico:', error);
        }
    }, [state.history, state.currentIndex]);

    // Sincroniza rota atual com histórico
    useEffect(() => {
        dispatch({
            type: actionTypes.UPDATE_CURRENT,
            payload: { path: location.pathname, state: location.state }
        });
    }, [location.pathname, location.state]);

    // Função para navegar para uma nova rota
    const push = useCallback((path, routeState = {}) => {
        // Debounce para prevenir navegações rápidas
        const now = Date.now();
        if (lastNavigationRef.current &&
            now - lastNavigationRef.current.timestamp < NAVIGATION_DEBOUNCE_MS) {
            return;
        }

        // Verifica se é um loop de navegação entre produtos
        if (path.startsWith('/produtos/')) {
            const productCode = path.split('/produtos/')[1];
            const lastProduct = state.navigationStack[state.navigationStack.length - 1];

            // Previne navegação circular imediata
            if (lastProduct === productCode) {
                console.warn('Prevenido loop de navegação para o mesmo produto:', productCode);
                return;
            }

            // Previne loops longos (mais de 3 produtos diferentes em ciclo)
            if (state.navigationStack.includes(productCode)) {
                console.warn('Possível loop de navegação detectado para produto:', productCode);
            }
        }

        dispatch({
            type: actionTypes.PUSH,
            payload: {
                path,
                state: routeState,
                timestamp: now
            }
        });

        lastNavigationRef.current = { path, timestamp: now };
        navigate(path, { state: routeState });
    }, [navigate, state.navigationStack]);

    // Função para voltar com validação de histórico
    const goBack = useCallback(() => {
        if (state.currentIndex > 0 && state.history.length > 1) {
            // Sempre volta para a entrada anterior válida
            let targetIndex = state.currentIndex - 1;

            // Procura pela primeira entrada válida anterior
            while (targetIndex >= 0) {
                const previousEntry = state.history[targetIndex];
                if (previousEntry && previousEntry.path) {
                    dispatch({ type: actionTypes.POP });
                    navigate(previousEntry.path, { state: previousEntry.state });
                    return true;
                }
                targetIndex--;
            }
        }

        // Se não há histórico válido, volta para home
        push('/');
        return false;
    }, [state.currentIndex, state.history, navigate, push]);

    // Função para substituir a rota atual
    const replace = useCallback((path, routeState = {}) => {
        dispatch({
            type: actionTypes.REPLACE,
            payload: {
                path,
                state: routeState,
                timestamp: Date.now()
            }
        });
        navigate(path, { state: routeState, replace: true });
    }, [navigate]);

    // Limpa o histórico (útil para logout)
    const clearHistory = useCallback(() => {
        dispatch({ type: actionTypes.CLEAR });
        localStorage.removeItem(NAVIGATION_STORAGE_KEY);
    }, []);

    // Verifica se pode voltar para um produto específico
    const canGoBackToProduct = useCallback((productCode) => {
        if (!productCode) return false;

        const productPath = `/produtos/${encodeURIComponent(productCode)}`;

        // Procura no histórico por este produto
        for (let i = state.currentIndex - 1; i >= 0; i--) {
            const entry = state.history[i];
            if (entry && entry.path === productPath) {
                return true;
            }
        }

        return false;
    }, [state.history, state.currentIndex]);

    // Vai para um produto específico no histórico
    const goBackToProduct = useCallback((productCode) => {
        if (!productCode) return false;

        const productPath = `/produtos/${encodeURIComponent(productCode)}`;

        // Encontra o índice do produto no histórico
        for (let i = state.currentIndex - 1; i >= 0; i--) {
            const entry = state.history[i];
            if (entry && entry.path === productPath) {
                // Navega para esta entrada
                dispatch({
                    type: actionTypes.REPLACE,
                    payload: {
                        path: entry.path,
                        state: entry.state,
                        timestamp: Date.now()
                    }
                });
                navigate(entry.path, { state: entry.state, replace: true });
                return true;
            }
        }

        return false;
    }, [state.history, state.currentIndex, navigate]);

    // Obtém a rota anterior
    const getPreviousRoute = useCallback(() => {
        if (state.currentIndex > 0) {
            return state.history[state.currentIndex - 1];
        }
        return null;
    }, [state.currentIndex, state.history]);

    // Verifica se a navegação veio de um produto específico
    const cameFromProduct = useCallback((productCode) => {
        const previous = getPreviousRoute();
        if (!previous || !productCode) return false;

        const productPath = `/produtos/${encodeURIComponent(productCode)}`;
        return previous.path === productPath;
    }, [getPreviousRoute]);

    // Context value
    const contextValue = {
        history: state.history,
        currentIndex: state.currentIndex,
        canGoBack: state.canGoBack,
        canGoForward: state.canGoForward,
        push,
        goBack,
        replace,
        clearHistory,
        canGoBackToProduct,
        goBackToProduct,
        getPreviousRoute,
        cameFromProduct,
        navigationStack: state.navigationStack
    };

    return (
        <NavigationContext.Provider value={contextValue}>
            {children}
        </NavigationContext.Provider>
    );
}

export const useNavigation = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within NavigationProvider');
    }
    return context;
};
