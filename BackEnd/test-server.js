import app from "./src/app.js";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 4000;

console.log("Tentando iniciar servidor...");
console.log(`Configuração: PORT=${PORT}`);
console.log(`DB_HOST=${process.env.DB_HOST}`);
console.log(`DB_USER=${process.env.DB_USER}`);
console.log(`DB_NAME=${process.env.DB_NAME}`);

try {
    const server = app.listen(PORT, () => {
        console.log(`✅ Servidor iniciado com sucesso na porta ${PORT}`);
        console.log(`🌐 Acesse: http://localhost:${PORT}`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });

    server.on('error', (error) => {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    });

} catch (error) {
    console.error('❌ Erro crítico ao iniciar aplicação:', error);
    process.exit(1);
}