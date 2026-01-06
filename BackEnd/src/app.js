import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import productRoutes from "./routes/productRoutes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { getPoolStatus } from "./config/db.js";

dotenv.config();

const app = express();

// Middleware de segurança: CORS configurável
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*", // Em produção, especificar domínio
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24h
};
app.use(cors(corsOptions));

// Middleware de limite de tamanho (proteger contra payloads grandes)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Middleware de logging de requisições (em produção, usar Winston ou Morgan)
// Middleware de request id e logging enriquecido
app.use((req, res, next) => {
  // Simple request id for traceability
  req.id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
  const start = Date.now();

  // Only essential request completion logging (status + duration)
  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `[REQ ${req.id}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 500) console.error(msg);
    else if (res.statusCode >= 400) console.warn(msg);
    else console.log(msg);
  });

  next();
});

// Health check com status do pool de conexões
app.get("/health", (req, res) => {
  const poolStatus = getPoolStatus();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: {
      activeConnections: poolStatus.activeConnections,
      idleConnections: poolStatus.idleConnections,
      waitingQueue: poolStatus.waitingQueue,
    },
  });
});

// Rotas da aplicação
app.use("/api", productRoutes);

// Middleware de 404 (deve vir após as rotas)
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Preload catalog once at startup (best-effort - não bloquear inicialização)
// preloadCatalog().catch(err => {
//   console.error('Erro no preload do catálogo:', err?.message || err);
// });

export default app;
