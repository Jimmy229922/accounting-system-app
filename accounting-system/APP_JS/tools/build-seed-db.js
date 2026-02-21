const path = require('path');
const crypto = require('crypto');

const targetSeedDir = path.resolve(process.cwd(), 'APP_JS', 'seed');
process.env.BACKEND_DATA_DIR = targetSeedDir;

const { db, initDB } = require(path.resolve(process.cwd(), 'backend', 'src', 'desktop-compat', 'db.js'));

initDB();

// Ensure auth tables exist
const ensureAuthUsersTableSql = `
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  )
`;

db.exec(ensureAuthUsersTableSql);

db.exec('DELETE FROM auth_users');
db.exec("DELETE FROM settings WHERE key IN ('auth_username','auth_password_salt','auth_password_hash','auth_created_at','auth_last_login_at','invite_code','invite_expiry')");

const username = 'Jimmy';
const password = 'A7med1221';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
const now = new Date();
const nowIso = now.toISOString();

const insertUser = db.prepare(`
  INSERT INTO auth_users (username, password_salt, password_hash, is_admin, is_active, created_at, last_login_at)
  VALUES (?, ?, ?, 1, 1, ?, ?)
`);
insertUser.run(username, salt, hash, nowIso, nowIso);

const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
upsertSetting.run('auth_username', username);
upsertSetting.run('auth_password_salt', salt);
upsertSetting.run('auth_password_hash', hash);
upsertSetting.run('auth_created_at', nowIso);
upsertSetting.run('auth_last_login_at', nowIso);

// Keep app data empty except one default warehouse label
const defaultWarehouseName = 'المخزن الافتراضي';
db.prepare('INSERT OR IGNORE INTO warehouses (name) VALUES (?)').run(defaultWarehouseName);

const stats = {
  users: db.prepare('SELECT COUNT(*) AS c FROM auth_users').get().c,
  units: db.prepare('SELECT COUNT(*) AS c FROM units').get().c,
  items: db.prepare('SELECT COUNT(*) AS c FROM items').get().c,
  customers: db.prepare('SELECT COUNT(*) AS c FROM customers').get().c,
  suppliers: db.prepare('SELECT COUNT(*) AS c FROM suppliers').get().c,
  salesInvoices: db.prepare('SELECT COUNT(*) AS c FROM sales_invoices').get().c,
  purchaseInvoices: db.prepare('SELECT COUNT(*) AS c FROM purchase_invoices').get().c,
  openingBalances: db.prepare('SELECT COUNT(*) AS c FROM opening_balances').get().c,
  warehouses: db.prepare('SELECT COUNT(*) AS c FROM warehouses').get().c
};

console.log(JSON.stringify({ ok: true, stats, dbPath: db.name }, null, 2));
db.close();
