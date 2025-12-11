import { useNotificationContext } from "../contexts/NotificationContext";

export function useNotification() {
  const { create, dismiss, update } = useNotificationContext();

  const success = (message, title = "Sucesso", options = {}) => create("success", title, message, options);
  const error = (message, title = "Erro", options = {}) => create("error", title, message, options);
  const info = (message, title = "Informação", options = {}) => create("info", title, message, options);
  const warning = (message, title = "Atenção", options = {}) => create("warning", title, message, options);
  const loading = (message = "Carregando...", title = "") => create("info", title, message, { autoClose: 0 });

  return { success, error, info, warning, loading, dismiss, update };
}
