import 'dotenv/config';
import { initDatabase } from '../config/initDatabase';
import { runCollection } from '../services/collectionService';
// Inicializa o banco e executa uma coleta manual pela linha de comando.
async function run() {
    await initDatabase();
    const result = await runCollection('cli');
    console.log(result);
    if (result.status !== 'sucesso') process.exitCode = 1;
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
