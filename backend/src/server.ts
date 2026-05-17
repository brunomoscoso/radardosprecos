import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import 'dotenv/config';

import routes from './routes';
import { initDatabase } from './config/initDatabase';

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

// registra as rotas
app.use(routes);

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if(err instanceof SyntaxError && 'body' in err){
        return res.status(400).json({ message: "JSON inválido" });
    }

    return res.status(500).json({ message: "Erro interno do servidor" });
})

async function startServer() {
    try {
        await initDatabase();

        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Erro ao inicializar o banco de dados:", error);
        process.exit(1);
    }
}

startServer();