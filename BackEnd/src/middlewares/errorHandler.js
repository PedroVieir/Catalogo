export function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.status || 500;
  const message =
    status >= 500
      ? "Erro interno no servidor"
      : err.message || "Erro ao processar requisição";

  res.status(status).json({ error: message });
}
