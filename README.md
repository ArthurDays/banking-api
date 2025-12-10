# ðŸ¦ NeoBank API

[![CI/CD Pipeline](https://github.com/ArthurDays/banking-api/actions/workflows/ci.yml/badge.svg)](https://github.com/ArthurDays/banking-api/actions/workflows/ci.yml)

API de transaÃ§Ãµes bancÃ¡rias com autenticaÃ§Ã£o JWT, desenvolvida com Node.js, Express e SQLite.

## ðŸ”’ Funcionalidades de SeguranÃ§a

- âœ… AutenticaÃ§Ã£o JWT com Refresh Tokens
- âœ… Rate Limiting (100 req/min global, 5 tentativas de login/min)
- âœ… Helmet (HTTP Security Headers)
- âœ… ValidaÃ§Ã£o de UUID e sanitizaÃ§Ã£o de inputs
- âœ… ProteÃ§Ã£o contra brute force

## ðŸš€ InstalaÃ§Ã£o

```bash
npm install
```

## â–¶ï¸ Executar

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo produÃ§Ã£o
npm start

# Testes
npm test

# Docker
docker-compose up --build
```

A API estarÃ¡ disponÃ­vel em `http://localhost:3000`

## ðŸ“š Endpoints

### AutenticaÃ§Ã£o

| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registrar novo usuÃ¡rio |
| POST | `/api/auth/login` | Login (retorna access e refresh token) |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Invalidar refresh token |
| GET | `/api/auth/me` | Dados do usuÃ¡rio atual |

### Contas BancÃ¡rias (ðŸ” Protegido)

| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/accounts` | Listar todas as contas |
| GET | `/api/accounts/:id` | Buscar conta por ID |
| GET | `/api/accounts/:id/balance` | Consultar saldo |
| GET | `/api/accounts/:id/statement` | Consultar extrato |
| POST | `/api/accounts` | Criar nova conta ðŸ” |
| PUT | `/api/accounts/:id` | Atualizar conta ðŸ” |
| DELETE | `/api/accounts/:id` | Desativar conta ðŸ” |

### TransaÃ§Ãµes (ðŸ” Protegido)

| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/transactions` | Listar transaÃ§Ãµes |
| GET | `/api/transactions/:id` | Buscar transaÃ§Ã£o |
| POST | `/api/transactions/deposit` | Realizar depÃ³sito ðŸ” |
| POST | `/api/transactions/withdraw` | Realizar saque ðŸ” |
| POST | `/api/transactions/transfer` | TransferÃªncia ðŸ” |
| POST | `/api/transactions/pix` | Realizar PIX ðŸ” |

### DocumentaÃ§Ã£o

| MÃ©todo | Endpoint | DescriÃ§Ã£o |
|--------|----------|-----------|
| GET | `/api/docs` | Swagger UI |
| GET | `/api/health` | Status da API |

## ðŸ“ Exemplos de Uso

### Registrar usuÃ¡rio
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "JoÃ£o", "email": "joao@email.com", "password": "senha123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "joao@email.com", "password": "senha123"}'
```

### Renovar token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "seu_refresh_token_aqui"}'
```

### Criar conta (autenticado)
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "holder_name": "JoÃ£o Silva",
    "document": "12345678901",
    "bank_code": "001",
    "agency": "1234",
    "account_number": "12345-6",
    "initial_balance": 1000
  }'
```

## ðŸ› ï¸ Stack

- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Database:** SQLite (sql.js)
- **Auth:** JWT + Refresh Tokens
- **Security:** Helmet, bcrypt, rate-limiting
- **Docs:** Swagger/OpenAPI
- **Tests:** Jest + Supertest
- **CI/CD:** GitHub Actions

## ðŸ“ Estrutura

```
banking-api/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ index.js          # Entry point
â”‚   â”œâ”€â”€ database.js       # SQLite setup
â”‚   â”œâ”€â”€ swagger.js        # OpenAPI config
â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â””â”€â”€ security.js   # Security middlewares
â”‚   â””â”€â”€ routes/
â”‚       â”œâ”€â”€ auth.js       # Authentication
â”‚       â”œâ”€â”€ accounts.js   # Accounts CRUD
â”‚       â””â”€â”€ transactions.js
â”œâ”€â”€ public/               # Frontend
â”œâ”€â”€ tests/               # Jest tests
â”œâ”€â”€ .github/workflows/   # CI/CD
â”œâ”€â”€ Dockerfile
â””â”€â”€ docker-compose.yml
```

## ðŸ“„ LicenÃ§a

MIT

