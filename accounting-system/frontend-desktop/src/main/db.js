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
            type TEXT DEFAULT 'customer',
            code INTEGER
        )
    `);

    // Attempt to add 'type' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'customer'");
    } catch (err) {
        // Column likely already exists, ignore error
    }

    // Attempt to add 'code' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN code INTEGER");
        // Backfill existing customers with sequential codes
        const rows = db.prepare("SELECT id FROM customers WHERE code IS NULL ORDER BY id ASC").all();
        const update = db.prepare("UPDATE customers SET code = ? WHERE id = ?");
        rows.forEach((row, i) => update.run(i + 1, row.id));
    } catch (err) {
        // Column likely already exists
    }

    // Attempt to add 'opening_balance' column if it doesn't exist (for existing databases)
    try {
        db.exec("ALTER TABLE customers ADD COLUMN opening_balance REAL DEFAULT 0");
        // Backfill: copy current balance as opening_balance for existing customers
        db.exec("UPDATE customers SET opening_balance = balance WHERE opening_balance = 0 AND balance != 0");
    } catch (err) {
        // Column likely already exists
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
            customer_id INTEGER, -- Link to customer (for direct payments)
            supplier_id INTEGER, -- Link to supplier (for direct payments)
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
    `);

    // Add columns if they don't exist
    try {
        db.exec("ALTER TABLE treasury_transactions ADD COLUMN customer_id INTEGER REFERENCES customers(id)");
        db.exec("ALTER TABLE treasury_transactions ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)");
    } catch (err) {}

    try {
        db.exec("ALTER TABLE treasury_transactions ADD COLUMN voucher_number TEXT");
    } catch (err) {}

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

    // 14. Sales Returns Table (جدول مردودات المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT,
            original_invoice_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            return_date TEXT DEFAULT CURRENT_DATE,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_invoice_id) REFERENCES sales_invoices(id),
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // 15. Sales Return Details Table (جدول تفاصيل مردودات المبيعات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales_return_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    // 16. Purchase Returns Table (جدول مردودات المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_returns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_number TEXT,
            original_invoice_id INTEGER NOT NULL,
            supplier_id INTEGER NOT NULL,
            return_date TEXT DEFAULT CURRENT_DATE,
            total_amount REAL DEFAULT 0,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (original_invoice_id) REFERENCES purchase_invoices(id),
            FOREIGN KEY (supplier_id) REFERENCES customers(id)
        )
    `);

    // 17. Purchase Return Details Table (جدول تفاصيل مردودات المشتريات)
    db.exec(`
        CREATE TABLE IF NOT EXISTS purchase_return_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            return_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
            FOREIGN KEY (item_id) REFERENCES items(id)
        )
    `);

    console.log('Database initialized at:', dbPath);
}

module.exports = {
    db,
    initDB
};