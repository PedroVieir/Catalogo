// components/ProductTransition.js
import { useEffect, useState } from 'react';

export default function ProductTransition({ children, productCode, isNavigating }) {
    const [isEntering, setIsEntering] = useState(true);
    const [prevCode, setPrevCode] = useState(productCode);

    useEffect(() => {
        if (productCode !== prevCode) {
            setIsEntering(false);
            const timer = setTimeout(() => {
                setIsEntering(true);
                setPrevCode(productCode);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [productCode, prevCode]);

    return (
        <div className={`product-transition ${isEntering ? 'entering' : 'exiting'} ${isNavigating ? 'navigating' : ''}`}>
            {children}
        </div>
    );
}