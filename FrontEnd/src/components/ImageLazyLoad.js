import React, { useRef, useEffect } from 'react';
import useLazyLoad from '../hooks/useLazyLoad';

/**
 * Componente ImageLazyLoad para carregamento preguiçoso de imagens
 * @param {Object} props
 * @param {string} props.src - URL da imagem
 * @param {string} props.alt - Texto alternativo
 * @param {string} props.className - Classes CSS adicionais
 * @param {Function} props.onError - Callback para erro de carregamento
 * @param {Object} props.lazyOptions - Opções do lazy loading
 * @param {string} props.placeholder - Conteúdo do placeholder (opcional)
 */
function ImageLazyLoad({
    src,
    alt,
    className = '',
    onError,
    lazyOptions = {},
    placeholder,
    ...props
}) {
    const imgRef = useRef(null);
    const { visibleItems, observeElement } = useLazyLoad(lazyOptions);
    const imageId = useRef(Math.random().toString(36).substr(2, 9));

    useEffect(() => {
        if (imgRef.current) {
            observeElement(imgRef.current);
        }
    }, [observeElement]);

    const isVisible = visibleItems.has(imageId.current);

    return (
        <img
            ref={imgRef}
            src={isVisible ? src : ''}
            alt={alt}
            className={`lazy-image ${className}`}
            onError={onError}
            data-lazy-id={imageId.current}
            {...props}
        />
    );
}

export default ImageLazyLoad;