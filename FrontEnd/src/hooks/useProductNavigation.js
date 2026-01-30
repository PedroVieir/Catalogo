import { useCallback, useRef } from 'react';
import { useNavigation } from '../contexts/NavigationContext';

export const useProductNavigation = () => {
    const navigation = useNavigation();
    const navigationLockRef = useRef(false);

    // Navega para um produto com tratamento especial
    const navigateToProduct = useCallback((productCode, context = null, additionalState = {}) => {
        if (!productCode || navigationLockRef.current) return;

        try {
            navigationLockRef.current = true;

            const path = `/produtos/${encodeURIComponent(String(productCode))}`;
            const state = {
                ...additionalState,
                fromProduct: context?.fromProduct || null,
                context: context?.type || null,
                navigationTimestamp: Date.now(),
                productChain: [...(navigation.navigationStack || [])]
            };

            // Adiciona delay mínimo para feedback visual
            setTimeout(() => {
                navigation.push(path, state);
                navigationLockRef.current = false;
            }, 50);

        } catch (error) {
            console.error('Erro na navegação entre produtos:', error);
            navigationLockRef.current = false;
        }
    }, [navigation]);

    // Navegação segura para peça do conjunto
    const navigateToConjuntoPiece = useCallback((pieceCode, parentCode) => {
        if (!pieceCode) return;

        navigateToProduct(pieceCode, {
            type: 'from-conjunto',
            fromProduct: parentCode
        }, {
            parentProductCode: parentCode,
            navigationType: 'conjunto'
        });
    }, [navigateToProduct]);

    // Navegação segura para conjunto do membership
    const navigateToMembershipConjunto = useCallback((conjuntoCode, pieceCode) => {
        if (!conjuntoCode) return;

        navigateToProduct(conjuntoCode, {
            type: 'from-piece',
            fromProduct: pieceCode
        }, {
            childProductCode: pieceCode,
            navigationType: 'membership'
        });
    }, [navigateToProduct]);

    // Volta para o produto anterior com contexto
    const goBackToPreviousProduct = useCallback((fallbackPath = '/') => {
            const previous = navigation.getPreviousRoute();

            if (previous) {
                // Se existe uma rota anterior (pode ser '/' ou outra), apenas faz goBack
                return navigation.goBack();
            }

            // Se não há rota anterior registrada, vai para fallback (home)
            navigation.push(fallbackPath);
            return false;
    }, [navigation]);

    // Verifica se pode voltar para o produto específico
    const canGoBackTo = useCallback((productCode) => {
        return navigation.canGoBackToProduct(productCode);
    }, [navigation]);

    return {
        navigateToProduct,
        navigateToConjuntoPiece,
        navigateToMembershipConjunto,
        goBackToPreviousProduct,
        canGoBackTo,
        ...navigation
    };
};