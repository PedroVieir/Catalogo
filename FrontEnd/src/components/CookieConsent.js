import React, { useState, useEffect, useRef } from 'react';
import '../styles/CookieConsent.css';

const CookieConsent = ({ onAccept }) => {
    const [show, setShow] = useState(false);
    const [showConfig, setShowConfig] = useState(false);
    const [preferences, setPreferences] = useState({
        analytics: true,
        location: true
    });
    const hasNotifiedRef = useRef(false);

    useEffect(() => {
        const consent = localStorage.getItem('cookieConsent');
        const savedPreferences = localStorage.getItem('cookiePreferences');

        if (!consent) {
            setShow(true);
        } else if ((consent === 'accepted' || consent === 'custom') && !hasNotifiedRef.current) {
            const prefs = savedPreferences ? JSON.parse(savedPreferences) : { analytics: true, location: true };
            hasNotifiedRef.current = true;
            onAccept(prefs);
        }
    }, [onAccept]);

    const handleAcceptAll = () => {
        const allPrefs = { analytics: true, location: true };
        localStorage.setItem('cookieConsent', 'accepted');
        localStorage.setItem('cookiePreferences', JSON.stringify(allPrefs));
        setShow(false);
        if (!hasNotifiedRef.current) {
            hasNotifiedRef.current = true;
            onAccept(allPrefs);
        }
    };

    const handleSaveConfig = () => {
        localStorage.setItem('cookieConsent', 'custom');
        localStorage.setItem('cookiePreferences', JSON.stringify(preferences));
        setShow(false);
        setShowConfig(false);
        if (!hasNotifiedRef.current) {
            hasNotifiedRef.current = true;
            onAccept(preferences);
        }
    };

    const handleConfigure = () => {
        setShowConfig(true);
    };

    const handleBackToMain = () => {
        setShowConfig(false);
    };

    const updatePreference = (type, value) => {
        setPreferences(prev => ({
            ...prev,
            [type]: value
        }));
    };

    if (!show) return null;

    return (
        <>
            <div className="cookie-consent">
                <div className="cookie-consent-content">
                    <p>
                        Utilizamos cookies para melhorar sua experiência e coletar dados para análise de leads.
                        Você pode aceitar todos ou personalizar suas preferências.
                    </p>
                    <div className="cookie-consent-buttons">
                        <button onClick={handleAcceptAll} className="accept-btn">Aceitar Todos</button>
                        <button onClick={handleConfigure} className="config-btn">Configurar</button>
                    </div>
                </div>
            </div>

            {showConfig && (
                <div className="cookie-config-modal">
                    <div className="cookie-config-content">
                        <h3>Configurar Cookies</h3>
                        <p>Escolha quais tipos de cookies você permite:</p>

                        <div className="cookie-option">
                            <div className="cookie-option-header">
                                <h4>Cookies de Analytics</h4>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.analytics}
                                        onChange={(e) => updatePreference('analytics', e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                            <p>Coleta dados de navegação para melhorar o site e gerar relatórios de leads. Não afeta a funcionalidade básica.</p>
                        </div>

                        <div className="cookie-option">
                            <div className="cookie-option-header">
                                <h4>Cookies de Localização</h4>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={preferences.location}
                                        onChange={(e) => updatePreference('location', e.target.checked)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                            <p>Coleta informações de localização aproximada para personalizar conteúdo. Não afeta a funcionalidade básica.</p>
                        </div>

                        <div className="cookie-config-buttons">
                            <button onClick={handleBackToMain} className="back-btn">Voltar</button>
                            <button onClick={handleSaveConfig} className="save-btn">Salvar Preferências</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CookieConsent;