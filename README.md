# NeoBank API

[![CI/CD Pipeline](https://github.com/ArthurDays/banking-api/actions/workflows/ci.yml/badge.svg)](https://github.com/ArthurDays/banking-api/actions/workflows/ci.yml)

API de transacoes bancarias com autenticacao JWT, desenvolvida com Node.js, Express e SQLite.

## Screenshots

### Tela de Login
![Login](docs/screenshots/01_login.png)

A tela de login permite que usuarios existentes acessem o sistema com email e senha. Novos usuarios podem criar uma conta clicando na aba "Criar Conta".

### Documentacao Swagger (API Docs)
![Swagger](docs/screenshots/02_swagger.png)

Documentacao interativa da API disponivel em `/api/docs`. Permite testar todos os endpoints diretamente no navegador.

---

## Funcionalidades

### Frontend
- **Dashboard**: Visao geral com saldo total e graficos de transacoes
- **Contas**: Gerenciamento de contas bancarias (criar, editar, desativar)
- **Transacoes**: Historico completo de movimentacoes
- **Transferencia**: Transferencia entre contas do sistema
- **PIX**: Transferencia instantanea por chave PIX (CPF/CNPJ)
- **Dark/Light Mode**: Alterne entre temas claro e escuro
- **Export PDF/CSV**: Exporte extratos em PDF ou CSV

### Backend (API)
- Autenticacao JWT com Refresh Tokens
- Rate Limiting (100 req/min global, 5 tentativas de login/min)
- Helmet (HTTP Security Headers)
- Validacao de UUID e sanitizacao de inputs
- Protecao contra brute force
- WebSocket para atualizacoes em tempo real

---

## Instalacao

```bash
npm install
```

## Executar

```bash
# Modo desenvolvimento (com hot reload)
npm run dev

# Modo producao
npm start

# Testes
npm test

# Docker
docker-compose up --build
```

A API estara disponivel em `http://localhost:3000`

---

## Endpoints da API

### Autenticacao

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/auth/register` | Registrar novo usuario |
| POST | `/api/auth/login` | Login (retorna access e refresh token) |
| POST | `/api/auth/refresh` | Renovar access token |
| POST | `/api/auth/logout` | Invalidar refresh token |
| GET | `/api/auth/me` | Dados do usuario atual |

### Contas Bancarias (Requer Autenticacao)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/accounts` | Listar todas as contas |
| GET | `/api/accounts/:id` | Buscar conta por ID |
| GET | `/api/accounts/:id/balance` | Consultar saldo |
| GET | `/api/accounts/:id/statement` | Consultar extrato |
| POST | `/api/accounts` | Criar nova conta |
| PUT | `/api/accounts/:id` | Atualizar conta |
| DELETE | `/api/accounts/:id` | Desativar conta |

### Transacoes (Requer Autenticacao)

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/transactions` | Listar transacoes |
| GET | `/api/transactions/:id` | Buscar transacao |
| POST | `/api/transactions/deposit` | Realizar deposito |
| POST | `/api/transactions/withdraw` | Realizar saque |
| POST | `/api/transactions/transfer` | Transferencia |
| POST | `/api/transactions/pix` | Realizar PIX |

### Utilitarios

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/docs` | Swagger UI |
| GET | `/api/health` | Status da API |

---

## Exemplos de Uso

### Registrar usuario
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Joao", "email": "joao@email.com", "password": "senha123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "joao@email.com", "password": "senha123"}'
```

### Criar conta bancaria (autenticado)
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "holder_name": "Joao Silva",
    "document": "12345678901",
    "bank_code": "001",
    "agency": "1234",
    "account_number": "12345-6",
    "initial_balance": 1000
  }'
```

### Realizar deposito
```bash
curl -X POST http://localhost:3000/api/transactions/deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"account_id": "UUID_DA_CONTA", "amount": 500}'
```

---

## Stack Tecnologica

| Categoria | Tecnologia |
|-----------|------------|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Database | SQLite (sql.js) |
| Auth | JWT + Refresh Tokens |
| Security | Helmet, bcrypt, rate-limiting |
| Docs | Swagger/OpenAPI |
| Tests | Jest + Supertest |
| CI/CD | GitHub Actions |
| Container | Docker |

---

## Estrutura do Projeto

```
banking-api/
|-- src/
|   |-- index.js          # Entry point
|   |-- database.js       # SQLite setup
|   |-- swagger.js        # OpenAPI config
|   |-- middleware/
|   |   |-- security.js   # Security middlewares
|   |-- routes/
|       |-- auth.js       # Authentication
|       |-- accounts.js   # Accounts CRUD
|       |-- transactions.js
|-- public/               # Frontend
|-- tests/                # Jest tests
|-- docs/                 # Documentation
|   |-- screenshots/      # App screenshots
|-- .github/workflows/    # CI/CD
|-- Dockerfile
|-- docker-compose.yml
```

---

## Licenca

MIT
