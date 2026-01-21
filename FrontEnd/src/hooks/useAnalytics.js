import { useEffect, useCallback, useRef, useState } from 'react';

const getOrCreateSessionId = () => {
    const key = 'analytics_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
        id =
            (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
            `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(key, id);
    }
    return id;
};

const useAnalytics = (preferences) => {
    const [hasInitialized, setHasInitialized] = useState(false);
    const hasCollectedRef = useRef(false);
    const isCollectingRef = useRef(false);

    const sendLog = useCallback(async (payload) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
            const res = await fetch(`${apiUrl}/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                // opcional: ler body para debugging
                const text = await res.text().catch(() => '');
                throw new Error(`Analytics POST failed: ${res.status} ${res.statusText} ${text}`);
            }

            // opcional
            // console.log('Analytics data sent successfully');
        } catch (error) {
            console.warn('Failed to send analytics:', error);
        }
    }, []);

    const collectData = useCallback(async () => {
        if (!preferences) return;

        // evita concorrência / chamadas duplicadas
        if (isCollectingRef.current) return;
        isCollectingRef.current = true;

        const sessionKey = 'analytics_collected_' + new Date().toDateString();
        const alreadyCollected = sessionStorage.getItem(sessionKey);

        if (hasCollectedRef.current || alreadyCollected) {
            isCollectingRef.current = false;
            return;
        }

        try {
            const payload = {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                referrer: document.referrer,
                sessionId: getOrCreateSessionId(),
            };

            // Dados básicos (se consent analytics não foi negado)
            if (preferences?.analytics !== false) {
                payload.userAgent = navigator.userAgent;
                payload.language = navigator.language;
                payload.platform = navigator.platform;

                // IP (tentativa; se falhar, segue sem IP)
                try {
                    const ipResponse = await fetch('https://api.ipify.org?format=json');
                    if (ipResponse.ok) {
                        const ipData = await ipResponse.json();
                        payload.ip = ipData?.ip;
                    }
                } catch (error) {
                    console.warn('Failed to get IP:', error);
                }
            }

            // Geolocalização somente se consent location não foi negado
            if (preferences?.location !== false && navigator.geolocation) {
                const geo = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) =>
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            }),
                        () => resolve(null),
                        { timeout: 10000 }
                    );
                });

                if (geo) payload.location = geo;
            }

            await sendLog(payload);

            // marca como coletado (por dia)
            sessionStorage.setItem(sessionKey, 'true');
            hasCollectedRef.current = true;
        } finally {
            isCollectingRef.current = false;
        }
    }, [preferences, sendLog]);

    useEffect(() => {
        // só executa se:
        // - temos preferências
        // - não inicializamos ainda
        // - existe ao menos um consent permitindo algo
        if (
            preferences &&
            !hasInitialized &&
            (preferences.analytics !== false || preferences.location !== false)
        ) {
            setHasInitialized(true);
            collectData();
        }
    }, [preferences, hasInitialized, collectData]);

    useEffect(() => {
        return () => {
            isCollectingRef.current = false;
        };
    }, []);

    // opcional: retornar algo para o componente
    return { hasInitialized };
};

export default useAnalytics;
