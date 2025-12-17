import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Validação das variáveis de ambiente obrigatórias
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Variável de ambiente obrigatória não encontrada: ${envVar}`);
  }
});

// Pool de conexões com configuração otimizada
// Nota: mysql2/promise retorna diretamente um pool com métodos promise
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  
  // Configuração de pool otimizada para consumo eficiente de recursos
  waitForConnections: true,                                         // Aguardar por conexão disponível ao invés de falhar
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),  // Limite máximo de conexões ativas
  queueLimit: 0,                                                    // Ilimitado (use com cuidado)
  
  // Timeouts para evitar conexões travadas
  connectionTimeout: parseInt(process.env.DB_CONN_TIMEOUT || "10000", 10),  // 10s para estabelecer conexão
  acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT || "10000", 10),  // 10s para adquirir conexão do pool
  
  // Segurança e confiabilidade
  enableKeepAlive: true,                // Manter conexão viva
  decimalNumbers: true,                 // Preservar precisão de números decimais
  multipleStatements: false,            // Desabilitar múltiplas statements (segurança)
  supportBigNumbers: true,              // Suportar números grandes
  bigNumberStrings: false,              // Retornar como número, não string
  
  // Configurações de charset
  charset: "utf8mb4",
  
  // Tratamento de timezone
  timezone: process.env.DB_TIMEZONE || "+00:00",
});

/**
 * Executa uma query SQL com prepared statements (seguro contra SQL injection)
 * Com retry automático para erros de conexão transitórios
 * @param {string} sql - Comando SQL com placeholders (?)
 * @param {Array} params - Parâmetros para a query
 * @param {number} retryCount - Número de tentativas restantes
 * @returns {Promise<Array>} Resultado da query
 */
export async function query(sql, params = [], retryCount = 2) {
  try {
    if (!sql || typeof sql !== "string") {
      throw new Error("SQL deve ser uma string não-vazia");
    }

    const start = Date.now();
    if (process.env.SQL_DEBUG === 'true') {
      console.debug(`SQL START (${new Date().toISOString()}): ${sql.substring(0, 200)} params=${params.length}`);
    }

    const [rows] = await pool.query(sql, params);

    const duration = Date.now() - start;
    if (process.env.SQL_DEBUG === 'true') {
      console.debug(`SQL OK (${duration}ms): returned ${Array.isArray(rows) ? rows.length : 'n/a'} rows`);
    }

    return rows;
  } catch (error) {
    // Classificar tipo de erro
    const isConnectionError = 
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "PROTOCOL_CONNECTION_LOST" ||
      error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR" ||
      error.code === "PROTOCOL_ENQUEUE_AFTER_DESTROY";
    
    const isTimeout = 
      error.code === "PROTOCOL_SEQUENCE_TIMEOUT" ||
      error.code === "ETIMEDOUT" ||
      error.code === "EHOSTUNREACH";

    // Se for erro de conexão/timeout e ainda temos retries, aguardar e tentar novamente
    if ((isConnectionError || isTimeout) && retryCount > 0) {
      const delay = Math.pow(2, 3 - retryCount) * 500; // Backoff exponencial: 500ms, 1000ms
      console.warn(
        `Erro de conexão ao BD (${error.code}). Aguardando ${delay}ms antes de retry #${3 - retryCount}...`
      );
      
      // Aguardar antes de tentar novamente
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      // Tentar novamente recursivamente
      return query(sql, params, retryCount - 1);
    }

    // Log estruturado do erro (sem expor dados sensíveis)
    console.error("Erro na query:", {
      sql: sql.substring(0, 100),
      params: params.length,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
}

/**
 * Inicia uma transação
 * @returns {Promise<Object>} Objeto com métodos commit(), rollback() e query()
 */
export async function beginTransaction() {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  return {
    query: async (sql, params = []) => {
      if (!sql || typeof sql !== "string") {
        throw new Error("SQL deve ser uma string não-vazia");
      }
      const [rows] = await connection.query(sql, params);
      return rows;
    },
    commit: async () => {
      await connection.commit();
      connection.release();
    },
    rollback: async () => {
      await connection.rollback();
      connection.release();
    },
  };
}

/**
 * Obtém status do pool de conexões
 * @returns {Object} Informações do pool
 */
export function getPoolStatus() {
  return {
    activeConnections: pool._allConnections?.length || 0,
    idleConnections: pool._freeConnections?.length || 0,
    waitingQueue: pool._connectionQueue?.length || 0,
  };
}

/**
 * Fecha o pool de conexões (para graceful shutdown)
 * @returns {Promise<void>}
 */
export async function closePool() {
  try {
    await pool.end();
    console.log("Pool de conexões encerrado com sucesso");
  } catch (error) {
    console.error("Erro ao encerrar pool:", error.message);
    throw error;
  }
}
