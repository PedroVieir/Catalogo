import React, { createContext, useContext, useMemo, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import "../styles/notification.css";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef(new Map());

  const create = useCallback((type, title, message, options = {}) => {
    const id = options.id || uuidv4();
    const ttl = typeof options.autoClose === "number" ? options.autoClose : 3000;

    const notif = {
      id,
      type: type || "info",
      title: title || "",
      message: message || "",
      createdAt: Date.now()
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

  const value = useMemo(() => ({ notifications, create, dismiss, update }), [notifications, create, dismiss, update]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-root" aria-live="polite" aria-atomic="true">
        {notifications.map((n) => (
          <div key={n.id} className={`notification notification--${n.type}`} role="status">
            <div className="notification__content">
              <div className="notification__body">
                {n.title && <div className="notification__title">{n.title}</div>}
                <div className="notification__message">{n.message}</div>
              </div>
              <div className="notification__actions">
                <button className="notification__close" onClick={() => dismiss(n.id)} aria-label="Fechar">×</button>
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
