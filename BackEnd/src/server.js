import app from "./app.js";
import dotenv from "dotenv";
import { closePool, getPoolStatus } from "./config/db.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});

// Graceful shutdown: encerrar conexões do pool antes de sair
const gracefulShutdown = async (signal) => {
  console.log(`\nRecebido sinal ${signal}. Iniciando shutdown gracioso...`);

  server.close(async () => {
    console.log("Servidor HTTP encerrado");
    try {
      await closePool();
      console.log("Aplicação encerrada com sucesso");
      process.exit(0);
    } catch (error) {
      console.error("Erro ao encerrar aplicação:", error);
      process.exit(1);
    }
  });

  // Timeout de segurança: forçar shutdown após 10s
  setTimeout(() => {
    console.error("Timeout no graceful shutdown, forçando saída...");
    process.exit(1);
  }, 10000);
};

// Listeners para sinais de shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Tratar erros não capturados
process.on("uncaughtException", (error) => {
  console.error("Exceção não capturada:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Promise rejection não tratada:", reason);
  gracefulShutdown("unhandledRejection");
});
