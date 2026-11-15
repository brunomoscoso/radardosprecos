// Inicializa o banco e os serviços agendados antes de iniciar o servidor HTTP.
import 'dotenv/config';
import { app } from './app';
import { initDatabase } from './config/initDatabase';
import { recoverInterruptedRuns } from './services/collectionService';
import { startScheduler } from './services/schedulerService';
async function startServer() {
    await initDatabase();
    await recoverInterruptedRuns();
    const stopScheduler = startScheduler();
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Servidor rodando em http://localhost:${port}`));
    const shutdown = () => { stopScheduler(); server.close(); };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
startServer().catch(error => { console.error('Erro ao iniciar servidor:', error); process.exitCode = 1; });
