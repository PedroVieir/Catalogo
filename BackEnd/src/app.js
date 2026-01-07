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

// Carrega variáveis de ambiente
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
// Lista padrão de origens permitidas. Inclui a URL da aplicação Vercel.
const defaultAllowedOrigins = ['http://localhost:3000', 'https://abr-catalogo.vercel.app'];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : defaultAllowedOrigins;
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requisições sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    // Se a origem estiver na lista de permitidas, autoriza
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Caso contrário, registra o bloqueio e responde com false (não lança erro para evitar status 500)
    logger.warn('CORS blocked request', { origin });
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 horas
};
app.use(cors(corsOptions));

// Middleware de limite de tamanho (proteger contra payloads grandes)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

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
      userAgent: req.get('User-Agent'),
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
app.get('/health', (req, res) => {
  const poolStatus = getPoolStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      activeConnections: poolStatus.activeConnections,
      idleConnections: poolStatus.idleConnections,
      waitingQueue: poolStatus.waitingQueue,
    },
  });
});

// Rota de log de analytics
app.post('/api/log', async (req, res) => {
  try {
    // Dados brutos enviados pelo cliente + informações de servidor
    const logData = {
      ...req.body,
      serverTimestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };
    logger.info('Analytics log received', logData);
    // Inserir no banco
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
    // Funções auxiliares para humanizar dados
    const humanizePlatform = (platform) => {
      const map = {
        Win32: 'Windows',
        MacIntel: 'macOS',
        'Linux x86_64': 'Linux',
        iPhone: 'iPhone',
        iPad: 'iPad',
        Android: 'Android',
      };
      return map[platform] || platform || 'Desconhecido';
    };
    const parseUserAgent = (uaString = '') => {
      const ua = uaString.toLowerCase();
      let deviceName = 'Desconhecido';
      let osName = '';
      let osVersion = '';
      let browserName = '';
      let browserVersion = '';
      if (ua.includes('iphone')) {
        deviceName = 'iPhone';
        osName = 'iOS';
        const m = uaString.match(/iphone os ([0-9_]+)/i);
        if (m) osVersion = m[1].replace(/_/g, '.');
        const b = uaString.match(/version\/([0-9.]+).*safari/i);
        if (b) {
          browserName = 'Safari';
          browserVersion = b[1];
        }
      } else if (ua.includes('android')) {
        deviceName = 'Android';
        osName = 'Android';
        const m = uaString.match(/android ([0-9.]+)/i);
        if (m) osVersion = m[1];
        const b = uaString.match(/chrome\/([0-9.]+)/i);
        if (b) {
          browserName = 'Chrome';
          browserVersion = b[1];
        }
      } else if (ua.includes('windows')) {
        deviceName = 'PC';
        osName = 'Windows';
        const m = uaString.match(/windows nt ([0-9.]+)/i);
        if (m) {
          const map = { '10.0': '10', '6.3': '8.1', '6.2': '8', '6.1': '7' };
          osVersion = map[m[1]] || m[1];
        }
        const b = uaString.match(/(edge|chrome|firefox|safari)\/([0-9.]+)/i);
        if (b) {
          browserName = b[1];
          browserVersion = b[2];
        }
      } else if (ua.includes('mac')) {
        deviceName = 'Mac';
        osName = 'macOS';
        const m = uaString.match(/mac os x ([0-9_]+)/i);
        if (m) osVersion = m[1].replace(/_/g, '.');
        const s = uaString.match(/version\/([0-9.]+).*safari/i);
        const b = uaString.match(/(chrome|firefox|safari)\/([0-9.]+)/i);
        if (s) {
          browserName = 'Safari';
          browserVersion = s[1];
        } else if (b) {
          browserName = b[1];
          browserVersion = b[2];
        }
      }
      return { deviceName, osName, osVersion, browserName, browserVersion };
    };
    // Humanização dos dados
    const formattedTime = new Date(logData.serverTimestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const clientIP = (logData.ip === '::1' || logData.ip === '127.0.0.1') ? 'localhost' : logData.ip;
    const { deviceName, osName, osVersion, browserName, browserVersion } = parseUserAgent(logData.userAgent || '');
    const platformFriendly = humanizePlatform(logData.platform);
    const locationString = logData.location
      ? `${logData.location.latitude?.toFixed(4)}, ${logData.location.longitude?.toFixed(4)}`
      : 'N/A';
    const logEntry = `\n=== LEAD LOG ENTRY ===\n` +
      `Data/Hora: ${formattedTime}\n` +
      `IP do Cliente: ${clientIP}\n` +
      `Idioma do Navegador: ${logData.language || 'N/A'}\n` +
      `Dispositivo: ${deviceName}\n` +
      `Sistema Operacional: ${osName}${osVersion ? ' ' + osVersion : ''}\n` +
      `Navegador: ${browserName}${browserVersion ? ' ' + browserVersion : ''}\n` +
      `Plataforma (raw): ${platformFriendly}\n` +
      `URL Atual: ${logData.url || 'N/A'}\n` +
      `URL de Referência: ${logData.referrer || 'Direto'}\n` +
      `Localização Aproximada: ${locationString}\n` +
      `===============================\n`;
    // Grava em arquivo (opcional)
    const fs = await import('fs');
    const path = await import('path');
    const logFilePath = path.join(process.cwd(), 'log-leads.txt');
    fs.appendFile(logFilePath, logEntry, 'utf8', (err) => {
      if (err) {
        logger.error('Failed to write to log-leads.txt', { error: err.message });
      }
    });
    res.json({ success: true });
  } catch (error) {
    logger.error('Error saving analytics log', { error: error.message });
    res.status(500).json({ error: 'Failed to save log' });
  }
});

// Endpoint para consultar os logs de analytics (até 1000 registros)
app.get('/api/analytics/logs', async (req, res) => {
  try {
    const sql = `\n      SELECT * FROM analytics_logs\n      ORDER BY timestamp DESC\n      LIMIT 1000\n    `;
    const results = await query(sql);
    res.json({ logs: results });
  } catch (error) {
    logger.error('Error fetching analytics logs', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Rotas da aplicação
app.use('/api', productRoutes);

// Middleware de 404 (deve vir após as rotas)
app.use(notFound);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler(logger));

// Pré-carregamento do catálogo ao iniciar (best-effort)
preloadCatalog().catch((err) => {
  logger.error('Erro no preload do catálogo:', err?.message || err);
});

export default app;