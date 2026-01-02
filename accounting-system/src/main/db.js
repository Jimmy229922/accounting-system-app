const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'accounting.db');
const db = new Database(dbPath);

function initDB() {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // 1. Units Table (جدول الوحدات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // 2. Items Table (جدول الأصناف)
    db.exec(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            unit_id INTEGER,
            cost_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            stock_quantity REAL DEFAULT 0,
            reorder_level INTEGER DEFAULT 0,
            FOREIGN KEY (unit_id) REFERENCES units(id)
        )
    `);

    // Add reorder_level column if it doesn't exist
    try {
        db.exec("ALTER TABLE items ADD COLUMN reorder_level INTEGER DEFAULT 0");
    } catch (err) {
        // Column likely already exists
    }

    // Add is_deleted column if it doesn't exist
    try {
        db.exec("ALTER TABLE items ADD COLUMN is_deleted INTEGER DEFAULT 0");
    } catch (err) {
        // Column likely already exists
    }

    // 3. Customers Table (جدول العملاء)
    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            balance REAL DEFAULT 0,
            type TEXT DEFAULT 'customer'
        )
    `);

    // Attempt to add 'type' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'customer'");
    } catch (err) {
        // Column likely already exists, ignore error
    }

    // 4. Suppliers Table (جدول الموردين)
    db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            balance REAL DEFAULT 0
        )
    `);

    // 5. Purchase Invoices Table (جدول فواتير المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            supplier_id INTEGER,
            invoice_date TEXT DEFAULT CURRENT_DATE,
            payment_type TEXT DEFAULT 'cash', -- 'cash' or 'credit'
            total_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES customers(id)
        )
    `);

    // Add columns if they don't exist
    try {
        db.exec("ALTER TABLE purchase_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'");
        db.exec("ALTER TABLE purchase_invoices ADD COLUMN paid_amount REAL DEFAULT 0");
        db.exec("ALTER TABLE purchase_invoices ADD COLUMN remaining_amount REAL DEFAULT 0");
    } catch (err) {}

    // 6. Purchase Invoice Details Table (جدول تفاصيل فاتورة المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_invoice_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_id INTEGER,
            quantity REAL,
            cost_price REAL,
            total_price REAL,
            FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 7. Sales Invoices Table (جدول فواتير المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT,
            customer_id INTEGER,
            invoice_date TEXT DEFAULT CURRENT_DATE,
            payment_type TEXT DEFAULT 'cash', -- 'cash' or 'credit'
            total_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // Add columns if they don't exist
    try {
        db.exec("ALTER TABLE sales_invoices ADD COLUMN payment_type TEXT DEFAULT 'cash'");
        db.exec("ALTER TABLE sales_invoices ADD COLUMN paid_amount REAL DEFAULT 0");
        db.exec("ALTER TABLE sales_invoices ADD COLUMN remaining_amount REAL DEFAULT 0");
    } catch (err) {}

    // 8. Sales Invoice Details Table (جدول تفاصيل فاتورة المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_invoice_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER,
            item_id INTEGER,
            quantity REAL,
            sale_price REAL,
            total_price REAL,
            FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 9. Treasury Transactions Table (جدول حركات الخزينة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS treasury_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'income' (قبض) or 'expense' (صرف)
            amount REAL NOT NULL,
            transaction_date TEXT DEFAULT CURRENT_DATE,
            description TEXT,
            related_invoice_id INTEGER, -- Optional: Link to sales/purchase invoice
            related_type TEXT, -- 'sales' or 'purchase'
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 10. Settings Table (جدول الإعدادات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);

    // 11. Warehouses Table (جدول المخازن)
    db.exec(`
        CREATE TABLE IF NOT EXISTS warehouses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // 12. Opening Balances Table (أرصدة أول المدة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            warehouse_id INTEGER NOT NULL,
            quantity REAL DEFAULT 0,
            cost_price REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
        )
    `);

    // 13. Opening Balance Groups (مجموعات أرصدة أول المدة)
    db.exec(`
        CREATE TABLE IF NOT EXISTS opening_balance_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    try {
        db.exec("ALTER TABLE opening_balances ADD COLUMN group_id INTEGER REFERENCES opening_balance_groups(id) ON DELETE CASCADE");
    } catch (err) {
        // Column likely exists
    }

    console.log('Database initialized at:', dbPath);
}

module.exports = {
    db,
    initDB
};