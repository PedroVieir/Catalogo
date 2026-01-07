import { useEffect, useCallback } from 'react';

const useAnalytics = (consentGiven) => {
    const sendLog = useCallback(async (data) => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
            await fetch(`${apiUrl}/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.warn('Failed to send analytics log:', error);
        }
    }, []);

    const collectData = useCallback(async () => {
        const data = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer,
        };

        // Get IP
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            data.ip = ipData.ip;
        } catch (error) {
            console.warn('Failed to get IP:', error);
        }

        // Get geolocation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    data.location = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    };
                    sendLog(data);
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                    sendLog(data);
                },
                { timeout: 10000 }
            );
        } else {
            sendLog(data);
        }
    }, [sendLog]);

    useEffect(() => {
        if (consentGiven) {
            collectData();
        }
    }, [consentGiven, collectData]);
};

export default useAnalytics;