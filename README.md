# Radar dos Preços

Comparação de preços do Continente e Pingo Doce. Backend Express/TypeScript, SQLite e frontend React/Vite. A recolha usa HTTP, Cheerio e cookies de sessão; não requer Playwright, Bourmet ou ferramentas CLI externas.

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

Abra a URL indicada pelo Vite, normalmente http://localhost:5173. Selecione os produtos e clique em **Salvar cesta**. A seleção fica neste navegador e não exige conta.

## Funcionamento

A cesta inicial usa embalagens fixas: arroz agulha 1 kg, feijão manteiga 500 g (exclui cozido), leite UHT meio-gordo 1 L, óleo de girassol 1 L, açúcar branco 1 kg, massa esparguete 500 g, farinha de trigo T55 sem fermento 1 kg, sal fino 250 g e manteiga com sal 250 g. As marcas podem variar. Variantes alimentares não pedidas e embalagens promocionais de quantidade ambígua são recusadas. A atualização transfere as seleções antigas para estes itens sem reutilizar os seus preços antigos.

- A seleção da cesta fica no armazenamento local do navegador; visitantes diferentes não alteram a seleção uns dos outros.
- No site publicado, o GitHub Actions pesquisa todo o catálogo às 08:00 e 20:00 UTC e republica um snapshot estático. O horário pode atrasar; no horário de verão, corresponde a 09:00 e 21:00 em Lisboa.
- O Pingo Doce exige confirmação do código postal com entrega em casa. Escolha de loja não é suportada.
- Os preços apresentados do Pingo Doce correspondem à localização de entrega configurada no servidor.
- São extraídos nome, preço da embalagem, quantidade e URL. A comparação exige correspondência verificável e embalagens equivalentes.
- A API local mantém o histórico no SQLite. No site estático, cada execução usa um banco temporário e publica apenas o snapshot atual; se uma coleta falhar, o último preço conhecido continua visível, mas não entra no total comparável.
- Só há vencedor quando ambos os mercados têm todos os itens válidos. Marcas podem variar. Portes e descontos de fidelização não são incluídos.
- Apenas a primeira página de resultados é analisada. Os endpoints dos sites podem mudar. Embalagens múltiplas e formatos desconhecidos são recusados.
- A interface atualiza o snapshot a cada 60 segundos; visitantes não iniciam pesquisas nos mercados.

## Publicar online

O site público usa somente GitHub Actions e GitHub Pages: não é necessário manter um servidor, API ou banco persistente online. O endereço será `https://brunomoscoso.github.io/radardosprecos/`.

1. Em **Settings → Secrets and variables → Actions → New repository secret**, crie `PINGO_DOCE_POSTAL_CODE` com um código postal válido no formato `0000-000`. O valor não é publicado no site.
2. Em **Settings → Pages**, selecione **GitHub Actions** como origem.
3. Faça push para `main` ou execute **Actions → Update data and deploy GitHub Pages → Run workflow**. O workflow recolhe os preços, gera o JSON e publica o site.

O workflow também atualiza os dados diariamente às 08:00 e 20:00 UTC; o GitHub pode atrasar execuções agendadas. A comparação é baseada no código postal configurado e não há histórico online persistente. O frontend usa o caminho `/radardosprecos/`; se configurar um domínio personalizado, ajuste o `base` em `frontend/vite.config.js` e `PREVIOUS_SNAPSHOT_URL` no workflow.

## Configuração do backend local

Estas opções são para executar a API localmente; o site do GitHub Pages não usa um backend online.

| Variável | Padrão / finalidade |
| --- | --- |
| PORT / HOST | 3000 / 127.0.0.1 |
| FRONTEND_ORIGIN | http://localhost:5173 |
| DATABASE_PATH | backend/database/database.sqlite; caminho alternativo opcional |
| PINGO_DOCE_POSTAL_CODE | Obrigatório, formato 0000-000 |
| TRUST_PROXY_HOPS | Opcional; saltos de proxy confiáveis para identificar o IP real no rate limit |
| SCRAPE_ENABLED | true; false desativa o agendamento local |
| SCRAPE_TIMEZONE | Europe/Lisbon |
| SCRAPE_TIMES | 08:00,20:00; dois horários distintos |
| PRICE_MAX_AGE_HOURS | 36; validade máxima dos preços |

Reinicie o backend depois de alterar o `.env`. No frontend em desenvolvimento, `VITE_API_URL` define a API local (padrão `http://localhost:3000`). Não versione ficheiros `.env`. Faça backup do SQLite antes de alterações operacionais.

## API local

Estas rotas servem o desenvolvimento local. O site público é estático e lê `data/prices.json`.

| Método e rota | Função |
| --- | --- |
| GET /health | Estado do serviço |
| GET /products | Catálogo da cesta |
| GET /markets | Mercados |
| GET /prices | Últimos preços guardados |
| GET /compare/basket?productIds=10,12 | Compara os produtos selecionados neste navegador |

As respostas de dados usam { success, data }. A API pública só expõe consultas; não há rotas para gravar a cesta nem iniciar coletas. Comparações aceitam apenas IDs inteiros do catálogo e são limitadas a 100 produtos. A API limita cada IP a 120 solicitações por minuto; atrás de um proxy, configure `TRUST_PROXY_HOPS` com o número correto de saltos.

## Estrutura e validação

### Consultar o SQLite

No explorador SQLite, use as vistas (Views) para evitar montar junções manualmente:

```sql
SELECT * FROM cesta_precos ORDER BY produto, mercado;
SELECT * FROM ultimas_consultas ORDER BY produto, mercado;
SELECT * FROM ultimos_precos;
```

`cesta_precos` mostra cada produto disponível do catálogo em cada mercado, incluindo os que ainda não têm preço. `ultimas_consultas` mostra o último estado e erro por produto/mercado. Estas vistas não duplicam dados. A validade por idade, falhas recentes e equivalência de embalagem continua a ser calculada por `GET /compare/basket`; um preço visível numa vista não garante que entre no total comparável.

As tabelas mantêm responsabilidades separadas: `produtos` e `mercados` são os catálogos; `precos` guarda o histórico; `execucoes` coordena cada atualização e o agendamento; `coletas` acompanha cada mercado; `coleta_resultados` regista sucesso ou falha por item, mesmo sem preço. A tabela `cesta` fica apenas para compatibilidade com dados antigos; a seleção atual é local ao navegador.

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
# Consulta manual pela linha de comando, usando todo o catálogo:
npm run scrape
cd ../frontend
npm run lint
npm run build
```

Para executar o backend compilado: npm start dentro de backend. A compatibilidade de leitura dos preços antigos é mantida para preservar os dados existentes.
