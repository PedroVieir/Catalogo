import { useState, useEffect, useRef } from 'react';

/**
 * Hook personalizado para lazy loading de imagens usando Intersection Observer
 * @param {Object} options - Opções do Intersection Observer
 * @param {string} options.rootMargin - Margem do root (padrão: '50px')
 * @param {number} options.threshold - Threshold de interseção (padrão: 0.1)
 * @param {Function} options.onVisible - Callback chamado quando um item fica visível
 * @returns {Object} - { visibleItems: Set, observeElement: Function, unobserveElement: Function }
 */
export function useLazyLoad(options = {}) {
    const [visibleItems, setVisibleItems] = useState(new Set());
    const observerRef = useRef(null);

    const { rootMargin = '100px', threshold = 0.01, onVisible } = options;

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const itemId = entry.target.dataset.lazyId;
                        if (itemId) {
                            setVisibleItems(prev => new Set([...prev, itemId]));
                            // Chamar callback se fornecido
                            onVisible?.(itemId);
                            // Opcional: parar de observar após tornar visível
                            observerRef.current?.unobserve(entry.target);
                        }
                    }
                });
            },
            { rootMargin, threshold }
        );

        return () => {
            observerRef.current?.disconnect();
        };
    }, [rootMargin, threshold, onVisible]);

    const observeElement = (element) => {
        if (observerRef.current && element) {
            observerRef.current.observe(element);
        }
    };

    const unobserveElement = (element) => {
        if (observerRef.current && element) {
            observerRef.current.unobserve(element);
        }
    };

    return { visibleItems, observeElement, unobserveElement };
}

export default useLazyLoad;