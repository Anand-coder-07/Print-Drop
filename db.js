const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'printdrop.db');

let db = null;
let dbReady = null; // Promise that resolves when DB is ready

/**
 * Initialize the database. Returns a promise that resolves to the db instance.
 * After first call, returns the cached instance.
 */
function initDb() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();

    // Load existing database file if it exists
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }

    initSchema();
    seedAdmin();
    return db;
  })();

  return dbReady;
}

/**
 * Get the database instance (synchronous, must call initDb() first).
 * Throws if DB hasn't been initialized yet.
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      code TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes (sql.js supports this)
  db.run('CREATE INDEX IF NOT EXISTS idx_uploads_code ON uploads(code)');
  db.run('CREATE INDEX IF NOT EXISTS idx_uploads_group_id ON uploads(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at)');
}

function seedAdmin() {
  const result = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (result.length === 0 || result[0].values.length === 0) {
    const hash = bcrypt.hashSync('printshop123', 10);
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('✅ Default admin user created (admin / printshop123)');
  }
  saveDb();
}

/**
 * Persist the database to disk.
 */
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// --- Helper wrappers to emulate better-sqlite3's prepare().get/all/run API ---

/**
 * Execute a query and return all rows as an array of objects.
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a query and return the first row as an object, or undefined.
 */
function queryGet(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE) and save to disk.
 */
function execute(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

module.exports = { initDb, getDb, saveDb, queryAll, queryGet, execute };
