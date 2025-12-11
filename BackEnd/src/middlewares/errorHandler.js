/**
 * Middleware de tratamento centralizado de erros
 * Captura exceções e retorna respostas padronizadas
 */
export function errorHandler(err, req, res, next) {
  // Determine o status HTTP apropriado
  let status = err.status || err.statusCode || 500;
  
  // Tratamento específico para erros de conexão - ajusta status HTTP
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "EHOSTUNREACH") {
    status = 503; // Service Unavailable
  } else if (err.code === "ETIMEDOUT" || err.code === "PROTOCOL_SEQUENCE_TIMEOUT") {
    status = 504; // Gateway Timeout
  } else if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
    status = 503; // Service Unavailable
  } else if (err.code === "ER_DUP_ENTRY") {
    status = 409; // Conflict
  } else if (err.code === "ER_NO_REFERENCED_ROW") {
    status = 409; // Conflict
  }
  
  // Logging estruturado (sem expor dados sensíveis em produção)
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    message: err.message,
    code: err.code,
  };

  if (status >= 500) {
    console.error("Erro do servidor:", errorLog);
  } else {
    console.warn("Erro do cliente:", errorLog);
  }

  // Mensagem de resposta (não expor detalhes internos em produção)
  let responseMessage = "Erro ao processar requisição";

  // Tratamento específico para diferentes tipos de erro
  if (err.code === "ECONNREFUSED") {
    responseMessage = "Banco de dados indisponível. Tente novamente em alguns segundos.";
  } else if (err.code === "ENOTFOUND" || err.code === "EHOSTUNREACH") {
    responseMessage = "Erro de conectividade. Verifique a configuração do banco de dados.";
  } else if (err.code === "ETIMEDOUT" || err.code === "PROTOCOL_SEQUENCE_TIMEOUT") {
    responseMessage = "Requisição expirou. O servidor está lento. Tente novamente.";
  } else if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
    responseMessage = "Conexão com banco de dados perdida. Tente novamente.";
  } else if (err.code === "PROTOCOL_ERROR") {
    responseMessage = "Erro de comunicação com o banco de dados. Tente novamente.";
  } else if (err.code === "ER_DUP_ENTRY") {
    responseMessage = "Registro duplicado. Verifique os dados informados.";
  } else if (err.code === "ER_NO_REFERENCED_ROW") {
    responseMessage = "Referência inválida. Verifique os IDs informados.";
  } else if (status >= 500) {
    responseMessage = "Erro interno do servidor. Tente novamente mais tarde.";
  } else if (status >= 400) {
    responseMessage = err.message || "Erro ao processar requisição";
  }

  res.status(status).json({
    error: responseMessage,
    ...(process.env.NODE_ENV === "development" && { details: err.message, code: err.code }),
  });
}
