import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import winston from "winston";

import productRoutes from "./routes/productRoutes.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { getPoolStatus, query } from "./config/db.js";
import { preloadCatalog } from "./services/products/productService.js";

dotenv.config();

// Configurar Winston para logs estruturados
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'abr-catalogo-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Middleware de rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requests por IP por janela
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.'
    });
  }
});

const app = express();

// Aplicar Helmet para headers de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Middleware de rate limiting
app.use(limiter);

// Middleware de segurança: CORS restritivo
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin, path: req?.path });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24h
};
app.use(cors(corsOptions));

// Middleware de limite de tamanho (proteger contra payloads grandes)
app.use(express.json({ limit: "1mb" })); // Reduzido para 1MB para segurança
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// Middleware de logging estruturado com Winston
app.use((req, res, next) => {
  req.id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000)}`;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.info('Request completed', logData);
    }
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

// Analytics log endpoint
app.post("/api/log", async (req, res) => {
  try {
    const logData = {
      ...req.body,
      serverTimestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    logger.info("Analytics log received", logData);

    // Insert into database
    const sql = `
      INSERT INTO analytics_logs 
      (client_ip, user_agent, browser_language, platform, current_url, referrer, public_ip, location_lat, location_lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      logData.ip,
      logData.userAgent,
      logData.language || null,
      logData.platform || null,
      logData.url || null,
      logData.referrer || null,
      logData.ip || null,
      logData.location ? logData.location.latitude : null,
      logData.location ? logData.location.longitude : null,
    ];

    await query(sql, params);

    // Also write to file as backup (optional)
    const fs = await import("fs");
    const path = await import("path");

    const logFilePath = path.join(process.cwd(), "log-leads.txt");
    const logEntry = `
=== LEAD LOG ENTRY ===
Timestamp: ${logData.serverTimestamp}
Client IP: ${logData.ip}
User Agent: ${logData.userAgent}
Browser Language: ${logData.language || "N/A"}
Platform: ${logData.platform || "N/A"}
Current URL: ${logData.url || "N/A"}
Referrer: ${logData.referrer || "N/A"}
Public IP: ${logData.ip || "N/A"}
Location: ${logData.location ? `${logData.location.latitude},${logData.location.longitude}` : "N/A"}
===============================\n`;

    fs.appendFile(logFilePath, logEntry, "utf8", (err) => {
      if (err) {
        logger.error("Failed to write to log-leads.txt", {
          error: err.message,
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error saving analytics log', { error: error.message });
    res.status(500).json({ error: 'Failed to save log' });
  }
});

// Get analytics logs (protected - add authentication in production)
app.get("/api/analytics/logs", async (req, res) => {
  try {
    const sql = `
      SELECT * FROM analytics_logs 
      ORDER BY timestamp DESC 
      LIMIT 1000
    `;
    const results = await query(sql);
    res.json({ logs: results });
  } catch (error) {
    logger.error('Error fetching analytics logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Rotas da aplicação
app.use("/api", productRoutes);

// Middleware de 404 (deve vir após as rotas)
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler(logger));

// Preload catalog once at startup (best-effort - não bloquear inicialização)
preloadCatalog().catch(err => {
  logger.error('Erro no preload do catálogo:', err?.message || err);
});

export default app;
