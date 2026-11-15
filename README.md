# Radar dos Preços

Comparação da cesta guardada no Continente e Pingo Doce. Backend Express/TypeScript, SQLite e frontend React/Vite. A recolha usa HTTP, Cheerio e cookies de sessão; não requer Playwright, Bourmet ou ferramentas CLI externas.

## Executar

Requer Node.js 22.12 ou posterior. No primeiro terminal:

```powershell
cd backend
npm ci
# Apenas na primeira instalação, se .env ainda não existir:
Copy-Item .env.example .env
npm run dev
```

Preencha PINGO_DOCE_POSTAL_CODE no backend/.env com o seu código real. No segundo terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Abra a URL indicada pelo Vite, normalmente http://localhost:5173. Selecione os produtos, clique em **Salvar cesta** e depois em **Consultar agora**.

## Funcionamento

A cesta inicial usa embalagens fixas: arroz agulha 1 kg, feijão manteiga 500 g (exclui cozido), leite UHT meio-gordo 1 L, óleo de girassol 1 L, açúcar branco 1 kg, massa esparguete 500 g, farinha de trigo T55 sem fermento 1 kg, sal fino 250 g e manteiga com sal 250 g. As marcas podem variar. Variantes alimentares não pedidas e embalagens promocionais de quantidade ambígua são recusadas. A atualização transfere as seleções antigas para estes itens sem reutilizar os seus preços antigos.

- A cesta fica no SQLite. Cada consulta lê a seleção guardada e pesquisa nos dois mercados.
- O agendamento executa às 08:00 e 20:00, no fuso Europe/Lisbon. O backend precisa de estar ligado; horários perdidos não são recuperados.
- O Pingo Doce exige confirmação do código postal com entrega em casa. Escolha de loja não é suportada.
- São extraídos nome, preço da embalagem, quantidade e URL. A comparação exige correspondência verificável e embalagens equivalentes.
- Produtos ausentes, bloqueios e erros ficam registados por item. O histórico é preservado; preços antigos ou de consultas falhadas não entram no total comparável.
- Só há vencedor quando ambos os mercados têm todos os itens válidos. Marcas podem variar. Portes e descontos de fidelização não são incluídos.
- Apenas a primeira página de resultados é analisada. Os endpoints dos sites podem mudar. Embalagens múltiplas e formatos desconhecidos são recusados.
- A interface consulta os resultados guardados a cada 15 segundos; isso não inicia novas pesquisas nos mercados.

## Configuração do backend

| Variável | Padrão / finalidade |
| --- | --- |
| PORT / HOST | 3000 / 127.0.0.1 |
| FRONTEND_ORIGIN | http://localhost:5173; várias origens separadas por vírgula |
| DATABASE_PATH | backend/database/database.sqlite; caminho alternativo opcional |
| PINGO_DOCE_POSTAL_CODE | Obrigatório, formato 0000-000 |
| SCRAPE_ENABLED | true; false desativa o agendamento |
| SCRAPE_TIMEZONE | Europe/Lisbon |
| SCRAPE_TIMES | 08:00,20:00; dois horários distintos |
| PRICE_MAX_AGE_HOURS | 36; validade máxima dos preços |

Reinicie o backend depois de alterar o .env. No frontend, VITE_API_URL define a API (padrão http://localhost:3000); alterações exigem reconstruir o build. Não versione ficheiros .env. Faça backup do SQLite antes de alterações operacionais.

## API

| Método e rota | Função |
| --- | --- |
| GET /health | Estado do serviço |
| GET /products | Catálogo da cesta |
| GET /markets | Mercados |
| GET /basket | Cesta guardada |
| PUT /basket | Guarda { "productIds": [10, 12] }; use IDs do catálogo |
| POST /collections | Consulta a cesta nos dois mercados e guarda os preços |
| GET /collections | Histórico das execuções, erros por item e agendamento |
| GET /prices | Últimos preços guardados |
| GET /compare/basket | Comparação, subtotais, validade e embalagens |

As respostas usam { success, data }. Coletas simultâneas são impedidas por bloqueio persistente; uma tentativa concorrente recebe HTTP 409. A consulta pode demorar: se a ligação cair, verifique GET /collections antes de repetir. Não existem rotas de edição de mercados, cadastro manual de preços ou comparação antiga por nome.

## Estrutura e validação

### Consultar o SQLite

No explorador SQLite, use as vistas (Views) para evitar montar junções manualmente:

```sql
SELECT * FROM cesta_precos ORDER BY produto, mercado;
SELECT * FROM ultimas_consultas ORDER BY produto, mercado;
SELECT * FROM ultimos_precos;
```

`cesta_precos` mostra cada produto selecionado em cada mercado, incluindo os que ainda não têm preço. `ultimas_consultas` mostra o último estado e erro por produto/mercado. Estas vistas não duplicam dados. A validade por idade, falhas recentes e equivalência de embalagem continua a ser calculada por `GET /compare/basket`; um preço visível numa vista não garante que entre no total comparável.

As tabelas mantêm responsabilidades separadas: `produtos` e `mercados` são os catálogos; `cesta` guarda a seleção; `precos` guarda o histórico; `execucoes` coordena cada atualização e o agendamento; `coletas` acompanha cada mercado; `coleta_resultados` regista sucesso ou falha por item, mesmo sem preço. Produtos antigos permanecem associados ao seu histórico.

A inicialização é transacional: `schema.ts` mantém o esquema e as vistas, `seedDatabase.ts` atualiza o catálogo e `initDatabase.ts` coordena ambos. Cópias locais de segurança ficam em `backend/database/backups/`, ignoradas pelo Git.

- backend/src/scrapers: catálogo inicial, pedidos HTTP, extração e validação.
- backend/src/services: cesta, persistência, comparação, coordenação e agendamento.
- backend/src/config: SQLite e migrações que preservam o histórico.
- backend/src/routes e controllers: API.
- backend/tests: testes sem acesso real aos mercados, com bancos temporários.
- frontend/src: seleção da cesta e apresentação dos resultados.

```powershell
cd backend
npm test
npm run build
# Consulta manual pela linha de comando, usando a cesta guardada:
npm run scrape
cd ../frontend
npm run lint
npm run build
```

Para executar o backend compilado: npm start dentro de backend. A compatibilidade de leitura dos preços antigos é mantida para preservar os dados existentes.
