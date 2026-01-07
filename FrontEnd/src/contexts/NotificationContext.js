import React, { createContext, useContext, useMemo, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { FiCheckCircle, FiAlertTriangle, FiXCircle, FiInfo, FiX } from "react-icons/fi";
import "../styles/notification.css";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef(new Map());

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle className="notification-icon success" />;
      case 'warning':
        return <FiAlertTriangle className="notification-icon warning" />;
      case 'error':
        return <FiXCircle className="notification-icon error" />;
      case 'info':
      default:
        return <FiInfo className="notification-icon info" />;
    }
  };

  const create = useCallback((type, title, message, options = {}) => {
    const id = options.id || uuidv4();
    const ttl = typeof options.autoClose === "number" ? options.autoClose : 5000;

    const notif = {
      id,
      type: type || "info",
      title: title || "",
      message: message || "",
      createdAt: Date.now(),
      icon: getNotificationIcon(type)
    };

    setNotifications((prev) => [...prev, notif]);

    if (ttl > 0) {
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        timers.current.delete(id);
      }, ttl);
      timers.current.set(id, timer);
    }

    return id;
  }, []);

  const dismiss = useCallback((id) => {
    if (id) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const t = timers.current.get(id);
      if (t) {
        clearTimeout(t);
        timers.current.delete(id);
      }
    } else {
      // dismiss all
      setNotifications([]);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    }
  }, []);

  const update = useCallback((id, patch = {}) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  // Métodos convenientes
  const success = useCallback((title, message, options) => create('success', title, message, options), [create]);
  const warning = useCallback((title, message, options) => create('warning', title, message, options), [create]);
  const error = useCallback((title, message, options) => create('error', title, message, options), [create]);
  const info = useCallback((title, message, options) => create('info', title, message, options), [create]);

  const value = useMemo(() => ({
    notifications,
    create,
    dismiss,
    update,
    success,
    warning,
    error,
    info
  }), [notifications, create, dismiss, update, success, warning, error, info]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-root" aria-live="polite" aria-atomic="true">
        {notifications.map((n) => (
          <div key={n.id} className={`notification notification--${n.type}`} role="status">
            <div className="notification__content">
              {n.icon}
              <div className="notification__body">
                {n.title && <div className="notification__title">{n.title}</div>}
                <div className="notification__message">{n.message}</div>
              </div>
              <div className="notification__actions">
                <button className="notification__close" onClick={() => dismiss(n.id)} aria-label="Fechar">
                  <FiX />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be used within NotificationProvider");
  return ctx;
}
