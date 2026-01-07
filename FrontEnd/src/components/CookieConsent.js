import React, { useState, useEffect } from 'react';
import '../styles/CookieConsent.css';

const CookieConsent = ({ onAccept, onReject }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            setShow(true);
        } else if (consent === 'accepted') {
            onAccept();
        }
    }, [onAccept]);

    const handleAccept = () => {
        localStorage.setItem('cookieConsent', 'accepted');
        setShow(false);
        onAccept();
    };

    const handleReject = () => {
        localStorage.setItem('cookieConsent', 'rejected');
        setShow(false);
        onReject();
    };

    if (!show) return null;

    return (
        <div className="cookie-consent">
            <div className="cookie-consent-content">
                <p>
                    Utilizamos cookies e coletamos informações públicas do seu navegador e localização para melhorar nossa experiência e criar dashboards de captação de clientes. Você concorda com essa coleta?
                </p>
                <div className="cookie-consent-buttons">
                    <button onClick={handleAccept} className="accept-btn">Aceitar</button>
                    <button onClick={handleReject} className="reject-btn">Rejeitar</button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;