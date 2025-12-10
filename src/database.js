const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'banking.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();

  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Criar tabelas
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      holder_name TEXT NOT NULL,
      document TEXT UNIQUE NOT NULL,
      bank_code TEXT NOT NULL,
      agency TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_type TEXT DEFAULT 'checking',
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      source_account_id TEXT,
      destination_account_id TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Refresh tokens table for JWT refresh functionality
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      revoked INTEGER DEFAULT 0
    );
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source_account_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_destination ON transactions(destination_account_id);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_accounts_document ON accounts(document);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);`);

  saveDatabase();

  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

// Helper para executar queries e retornar resultados como array de objetos
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase,
  query,
  queryOne,
  run
};
