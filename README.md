# Radar dos Preços

Radar dos Preços é uma aplicação em desenvolvimento focada na comparação de preços de produtos entre diferentes mercados.  
O objetivo do projeto é coletar, armazenar e disponibilizar informações de preços de forma estruturada, permitindo identificar onde determinados produtos estão mais baratos.

## Objetivo

O sistema foi pensado para ajudar na consulta e comparação de preços de itens do dia a dia, reunindo dados de diferentes estabelecimentos em uma única base.

## Tecnologias utilizadas

### Back-end
- Node.js
- Express
- TypeScript
- SQLite

### Coleta de dados
- Playwright

### Front-end
- React
- TypeScript
- Vite

## Funcionalidades atuais
- Estrutura inicial de API com Express
- Cadastro e consulta de mercados
- Estrutura de banco de dados com SQLite
- Inicialização automática das tabelas
- Coleta inicial de produtos via automação com Playwright
- Separação de responsabilidades em controllers, services e routes

## Estrutura do projeto

```bash
RASTRAPRECOS/
├── backend/
│   ├── database/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── scrapers/
│   │   ├── services/
│   │   ├── types/
│   │   └── server.ts
│   └── package.json
├── frontend/
