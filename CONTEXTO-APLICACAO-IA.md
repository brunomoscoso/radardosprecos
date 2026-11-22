# Contexto da aplicação — Radar dos Preços

Este documento descreve o estado atual do projeto para orientar outra IA ou pessoa que vá continuar o desenvolvimento. Ele complementa o [README principal](README.md), que contém as instruções rápidas de instalação e publicação.

## 1. Objetivo e estado atual

O Radar dos Preços compara uma cesta básica entre Continente e Pingo Doce, em Portugal. A lista de produtos é mantida pelo projeto; visitantes escolhem os itens que querem comparar e veem preços, embalagens, subtotais e o mercado mais barato quando a comparação é válida.

O site público está publicado em:

- <https://brunomoscoso.github.io/radardosprecos/>

A publicação usa **GitHub Actions + GitHub Pages**. Não há servidor Express nem banco persistente online. O backend continua no repositório para:

- executar localmente a API e o agendamento tradicional;
- fazer a coleta e preparar o snapshot que o Pages publica;
- manter o catálogo, persistência, validação e regras de comparação comuns às duas formas de execução.

## 2. Arquitetura em uma visão

```text
GitHub Actions (push em main, cron UTC ou execução manual)
  ├─ configura Node.js 22 e instala o backend
  ├─ cria SQLite temporário no runner
  ├─ coleta os dois mercados usando PINGO_DOCE_POSTAL_CODE
  ├─ gera frontend/public/data/prices.json
  ├─ instala, valida e compila o frontend
  └─ publica frontend/dist no GitHub Pages

Visitante
  ├─ baixa o frontend estático e o snapshot JSON
  ├─ guarda sua seleção no localStorage do próprio navegador
  └─ calcula a comparação da seleção no navegador
```

O modo de desenvolvimento local é diferente do modo publicado:

- **Local:** React usa a API Express em `VITE_API_URL`; a API lê o SQLite local.
- **Publicado:** React lê `data/prices.json` e não faz chamadas à API Express.

Esse desvio é controlado por `import.meta.env.DEV` em `frontend/src/App.jsx`.

## 3. Fluxo do GitHub Pages

O workflow está em `.github/workflows/deploy-pages.yml` e é disparado por:

1. push para a branch `main`;
2. cron diário às **08:00 e 20:00 UTC**;
3. execução manual em **Actions → Update data and deploy GitHub Pages → Run workflow**.

O GitHub pode atrasar uma execução agendada. O horário é UTC: em Lisboa, 08:00/20:00 no horário de inverno e 09:00/21:00 no horário de verão.

Passos do job de build:

1. checkout do repositório e configuração do Node.js 22;
2. instalação das dependências do backend com `npm ci`;
3. execução de `npm run snapshot`;
4. instalação das dependências do frontend, lint e build;
5. upload de `frontend/dist` como artefato do Pages;
6. deploy do artefato no GitHub Pages.

### Geração e forma do snapshot

O entry point é `backend/src/scrapers/createSnapshot.ts`; o serviço que preserva preços anteriores é `backend/src/services/staticSnapshotService.ts`.

- O runner define `DATABASE_PATH` para um SQLite temporário, não para `backend/database/database.sqlite`.
- `initDatabase()` cria o esquema e popula o catálogo.
- `runCollection('github-actions')` coleta todos os produtos com `basketOption` habilitado nos dois mercados.
- `compareSelectedProducts()` gera comparação para o catálogo inteiro.
- O arquivo é escrito em `frontend/public/data/prices.json`. Ele é gerado durante a execução e ignorado pelo Git; não é necessário mantê-lo versionado.
- O Vite copia `public/data/prices.json` para `frontend/dist/data/prices.json`; no site ele fica em `/radardosprecos/data/prices.json`.
- O documento JSON contém `generatedAt`, `collectionStatus` e `comparison`.

O workflow passa `PREVIOUS_SNAPSHOT_URL` com o endereço do snapshot publicado. Um `404` é tratado como primeira publicação; erros HTTP diferentes ou JSON inválido interrompem o job para evitar substituir o site com uma publicação incoerente.

Quando uma nova coleta não obtém preço para um item, `carryForwardPrices()` pode trazer o último preço conhecido do snapshot anterior. Esse valor permanece **não utilizável para comparação** (`usable: false`), recebe aviso de preço não confirmado/desatualizado e só aparece como informação/subtotal salvo. Ele não pode determinar o vencedor.

### Configuração obrigatória no GitHub

Em **Settings → Secrets and variables → Actions**, deve existir o secret:

- `PINGO_DOCE_POSTAL_CODE`: código postal de Portugal no formato `0000-000`.

O valor não deve ser escrito no código, versionado ou enviado a uma IA. A coleta do Pingo Doce é configurada para entrega em casa para esse código postal. O snapshot e o site são públicos.

## 4. Comportamento do frontend

Pontos de entrada:

- `frontend/src/main.jsx`: monta o React.
- `frontend/src/App.jsx`: carrega catálogo/preços, mantém seleção, calcula a cesta escolhida e apresenta resultados.
- `frontend/src/App.css` e `frontend/src/index.css`: componentes e estilos responsivos.
- `frontend/src/api.js`: cliente HTTP usado no desenvolvimento local.

Comportamento:

- A seleção é guardada no `localStorage` sob a chave `radar-basket-product-ids`.
- Não há contas nem cesta compartilhada entre visitantes.
- Em produção, o JSON é carregado no caminho relativo ao `BASE_URL`; os dados são atualizados na interface a cada 60 segundos. Isso só relê o snapshot já publicado — não dispara uma coleta.
- Em desenvolvimento, catálogo e comparação são obtidos da API local.
- O usuário seleciona um ou mais produtos elegíveis, salva a seleção e recebe cartões para os dois mercados.
- O site só indica vencedor se os dois mercados tiverem todos os preços válidos e as quantidades forem equivalentes.
- Preços ausentes, erros de coleta, preços antigos e embalagens não verificadas são indicados; preços não válidos podem ser mostrados sem participar do total.
- A interface não considera portes de entrega nem descontos de fidelização.
- O layout é responsivo; o cartão vencedor recebe destaque visual.

O `base` do Vite em `frontend/vite.config.js` é `/radardosprecos/` quando `GITHUB_ACTIONS=true` e `/` em execução local. Ao mudar para domínio personalizado, revisar também `PREVIOUS_SNAPSHOT_URL` no workflow.

## 5. Catálogo e regras de produto

O catálogo inicial está em `backend/src/scrapers/config/products.ts` e é sincronizado no SQLite por `seedDatabase.ts`.

Produtos elegíveis atuais:

1. Arroz Agulha 1kg
2. Feijão Manteiga 500g
3. Leite UHT Meio Gordo 1L
4. Óleo de Girassol 1L
5. Açúcar Branco 1kg
6. Massa Esparguete 500g
7. Farinha de Trigo T55 sem Fermento 1kg
8. Sal Fino 250g
9. Manteiga com Sal 250g

As regras de normalização e equivalência ficam principalmente em `backend/src/scrapers/helpers/normalizeProductData.ts`:

- converte preços no formato português para número em euros;
- normaliza nomes, acentos e algumas variantes/sinônimos;
- converte quantidade para unidade comparável em gramas ou mililitros;
- rejeita packs múltiplos, ofertas com quantidade promocional ambígua e embalagens desconhecidas;
- rejeita variantes alimentares não pedidas (por exemplo, integral, sem lactose ou feijão cozido);
- exige embalagem compatível com o produto solicitado.

`chooseOffer()` em `backend/src/scrapers/markets/shared.ts` filtra candidatos verificáveis e escolhe o menor preço entre as ofertas compatíveis. O URL da oferta deve ser HTTPS e pertencer ao domínio esperado do mercado.

Alterações no catálogo devem considerar as migrações em `seedDatabase.ts` e `basketReplacements`: itens antigos podem ter a seleção transferida para um produto específico, sem associar automaticamente preços antigos ao novo item.

## 6. Backend e coleta

### Servidor Express local

`backend/src/server.ts` carrega `.env`, inicializa o banco, recupera execuções interrompidas, inicia o agendador local e abre o Express. `backend/src/app.ts` configura CORS, limite de requisições, JSON e tratamento central de erros.

`backend/src/routes/index.ts` monta atualmente estes endpoints:

| Método | Rota | Uso |
| --- | --- | --- |
| GET | `/health` | Estado da API |
| GET | `/products` | Catálogo de produtos |
| GET | `/markets` | Mercados cadastrados |
| GET | `/prices` | Último preço por produto/mercado |
| GET | `/compare/basket?productIds=1,2` | Comparação para IDs selecionados |

As rotas de dados retornam `{ success, data }`; `/health` tem resposta própria. As rotas acessíveis são de consulta. `basketController.ts` e `collectionController.ts` existem no código, mas não estão montados em `routes/index.ts`; não assumir que há endpoints públicos para salvar cestas ou iniciar coletas.

`compareSelectedProducts()` valida IDs positivos, únicos, existentes no catálogo e limita a 100 IDs. O rate limit em memória é de 120 requisições por IP por minuto; excedentes recebem HTTP 429. Se a API local estiver atrás de proxy, `TRUST_PROXY_HOPS` deve corresponder à topologia real.

### Orquestração

`backend/src/services/collectionService.ts`:

- por padrão coleta todos os produtos do catálogo elegíveis;
- cria uma execução e uma coleta por mercado;
- impede execuções concorrentes;
- registra resultado por produto, inclusive quando não há preço;
- recupera execuções interrompidas;
- permite adapters falsos nos testes.

`scraperPersistenceService.ts` salva preço, nome encontrado, quantidade e URL somente depois de validar o resultado. Falhas são registradas por item e não apagam o histórico de preços.

### Scrapers

Os scrapers ficam em `backend/src/scrapers/markets/`:

- `mercadoA.scraper.ts`: busca no Continente.
- `mercadoB.scraper.ts`: valida/aplica o código postal e busca no Pingo Doce.

Ambos usam HTTP, Cheerio e o contrato comum `Scraper`; não usam Playwright. `HttpSession` mantém cookies por sessão, limita redirecionamentos à mesma origem e aplica timeout às requisições. `parseOffers.ts` extrai candidatos do HTML. Os seletores dependem da estrutura atual dos sites e podem quebrar quando os sites mudarem.

O fluxo do Pingo Doce exige que o código postal seja válido e que a resposta confirme entrega em casa. Escolha de loja não é suportada. A primeira página de resultados é a analisada; não há garantia de que todos os produtos existentes nos sites serão encontrados.

### Comparação

`backend/src/services/compareService.ts` usa a consulta mais recente por produto/mercado. Por padrão:

- `PRICE_MAX_AGE_HOURS` é 36;
- um preço só é utilizável se tiver quantidade verificada, não for legado nem estiver vencido e corresponder a uma coleta bem-sucedida mais recente;
- subtotal dos preços utilizáveis e subtotal de preços apenas salvos são conceitos distintos;
- não há vencedor se algum mercado estiver incompleto ou se as quantidades de um produto diferirem entre mercados;
- empates são retornados como mais de um `cheapestMarketId`.

O frontend reaplica as mesmas regras da comparação ao subconjunto de IDs selecionado pelo visitante, a partir do snapshot completo.

## 7. SQLite e persistência

O acesso é centralizado em `backend/src/config/database.ts`; `DATABASE_PATH` pode substituir o caminho padrão `backend/database/database.sqlite`. `withDB()` abre e fecha conexões. `initDatabase()` executa migração e seed em uma transação.

Tabelas principais:

- `produtos` e `mercados`: catálogos e chaves dos scrapers;
- `precos`: histórico de ofertas encontradas;
- `execucoes`: execução completa, origem e estado;
- `coletas`: execução por mercado;
- `coleta_resultados`: estado/erro de cada produto em cada coleta;
- `cesta`: compatibilidade com seleção antiga no SQLite; a cesta atual do site está no navegador.

Views:

- `ultimos_precos`: resolve o último preço e regras de compatibilidade com dados históricos;
- `cesta_precos`: combina os produtos da cesta básica com os mercados, inclusive quando não há preço;
- `ultimas_consultas`: último resultado por produto/mercado.

No deploy Pages, o SQLite fica em `runner.temp` e desaparece no fim do job. O workflow carrega o snapshot anterior para manter preços informativos em caso de falha, mas não mantém histórico completo online. O SQLite local pode conter histórico útil: não o apagar sem verificar/guardar os dados. Remover o arquivo persistido é diferente de remover o código SQLite, que ainda é usado pelo backend e pelo pipeline de snapshot.

## 8. Variáveis de ambiente

Backend, exemplos em `backend/.env.example`:

| Variável | Finalidade |
| --- | --- |
| `PORT` | Porta HTTP; padrão 3000 |
| `HOST` | Endereço de escuta; padrão `127.0.0.1` |
| `FRONTEND_ORIGIN` | Origem CORS local; padrão `http://localhost:5173` |
| `DATABASE_PATH` | Caminho alternativo para SQLite |
| `PINGO_DOCE_POSTAL_CODE` | Código postal para entrega em casa |
| `TRUST_PROXY_HOPS` | Saltos confiáveis do proxy, se existir |
| `SCRAPE_ENABLED` | Ativa/desativa agendador do servidor local |
| `SCRAPE_TIMEZONE` | Fuso local; padrão `Europe/Lisbon` |
| `SCRAPE_TIMES` | Dois horários locais; padrão `08:00,20:00` |
| `PRICE_MAX_AGE_HOURS` | Validade máxima para comparação; padrão 36 |

Frontend:

- `VITE_API_URL`: endereço da API no modo de desenvolvimento; padrão `http://localhost:3000`.
- `GITHUB_ACTIONS`: definido pelo runner; Vite usa esse estado para selecionar o `base` do Pages.

O workflow define `DATABASE_PATH`, `PINGO_DOCE_POSTAL_CODE` e `PREVIOUS_SNAPSHOT_URL`. Não versionar `.env` nem divulgar o valor do código postal.

## 9. Estrutura importante do repositório

```text
.github/workflows/deploy-pages.yml   Coleta, build e deploy do Pages
backend/src/
  config/                            SQLite, schema, migrações e catálogo
  controllers/                       Handlers HTTP; conferir rotas montadas
  middleware/                        Rate limit da API
  routes/                            Endpoints atualmente expostos
  scrapers/config/                   Catálogo inicial
  scrapers/helpers/                  HTTP, parsing e normalização
  scrapers/markets/                  Scrapers dos dois mercados
  services/                          Coleta, persistência, comparação e scheduler
  tests/                             Testes do backend
frontend/src/                        React, API local e estilos
frontend/public/                     Assets estáticos; snapshot é gerado aqui
```

## 10. Instalação, comandos e validação

Requisito documentado: Node.js 22.12 ou posterior. Backend e frontend têm `package.json`, lockfile e dependências independentes.

### Desenvolvimento local

Terminal 1:

```powershell
cd backend
npm ci
Copy-Item .env.example .env # apenas se .env ainda não existir
# Preencher PINGO_DOCE_POSTAL_CODE em backend/.env
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm ci
npm run dev
```

Comandos do backend:

- `npm test`: testes com bancos temporários e scrapers simulados; os testes HTTP verificam parsing/sessão sem depender dos sites estarem disponíveis.
- `npm run build`: compila TypeScript para `backend/dist`.
- `npm start`: inicia o servidor compilado.
- `npm run scrape`: coleta o catálogo usando o SQLite local.
- `npm run snapshot`: coleta e gera `frontend/public/data/prices.json`; exige código postal válido e faz requisições reais aos mercados. Não usar como simples validação sem considerar esse efeito.

Comandos do frontend: `npm run lint`, `npm run build` e `npm run preview`.

## 11. Limitações e cuidados para futuras alterações

- O site publicado é estático; uma cesta não pode solicitar uma coleta ao vivo.
- A atualização visível depende do último deploy; recarregar a cada 60 segundos não acelera o cron.
- GitHub Actions pode atrasar o cron ou não executá-lo imediatamente.
- O código postal usado no Pingo Doce define a região de entrega para todos os visitantes.
- Os seletores dos scrapers dependem do HTML/fluxos dos mercados e podem exigir manutenção.
- O catálogo é deliberadamente pequeno e não representa todos os produtos dos supermercados.
- Não usar preços legados, vencidos, com embalagem ambígua ou coleta falhada para proclamar um vencedor.
- Não publicar secrets ou `.env`, não commitar o JSON gerado nem confundir o banco temporário do Actions com o banco local.
- Ao alterar a forma do snapshot, atualizar em conjunto `createSnapshot.ts`, o consumidor em `App.jsx`, o teste `carryForwardPrices` e esta documentação.
- Ao adicionar/remover endpoints, conferir `routes/index.ts`, controladores, CORS, rate limit e a distinção entre API local e site publicado.

## 12. Testes e áreas cobertas

Os testes existentes cobrem inicialização/migração do SQLite, catálogo e seleção, concorrência/recuperação de coleta, persistência de preços, comparação, erros, equivalência de embalagens, parsing HTTP, cookies/redirecionamentos, código postal do Pingo Doce, rotas públicas e preservação de preços no snapshot sem torná-los comparáveis.
