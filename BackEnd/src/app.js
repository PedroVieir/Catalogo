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
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
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

export default app;
