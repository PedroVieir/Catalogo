import { useEffect, useRef, useState } from "react";

/**
 * Hook para debounce otimizado
 * Evita múltiplas chamadas desnecessárias
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para throttle
 * Limita a frequência de execução de uma função
 */
export function useThrottle(callback, delay = 300) {
  const lastCallRef = useRef(null);
  const timeoutRef = useRef(null);

  return (...args) => {
    const now = Date.now();

    if (lastCallRef.current === null || now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = now;
        callback(...args);
      }, delay - (now - lastCallRef.current));
    }
  };
}
