const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // --- Customers Handlers ---

    ipcMain.handle('get-customers', () => {
        try {
            return db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
        } catch (error) {
            console.error('[get-customers] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-debtor-creditor-report', (event, { startDate, endDate }) => {
        try {
        const customers = db.prepare('SELECT id, name, type, balance as current_balance, phone FROM customers ORDER BY name ASC').all();
        
        const sDate = startDate || '1900-01-01';
        const eDate = endDate || '9999-12-31';
        const futureDate = endDate || '9999-12-31';

        // Batch: Future sales per customer (1 query instead of N)
        const futureSalesMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date > ?
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futureSalesMap[r.customer_id] = r.total; });

        // Batch: Future purchases per supplier
        const futurePurchasesMap = {};
        db.prepare(`
            SELECT supplier_id, SUM(total_amount) as total 
            FROM purchase_invoices 
            WHERE invoice_date > ?
            GROUP BY supplier_id
        `).all(futureDate).forEach(r => { futurePurchasesMap[r.supplier_id] = r.total; });

        // Batch: Future sales payments per customer
        const futureSalesPaymentsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(paid_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date > ?
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futureSalesPaymentsMap[r.customer_id] = (futureSalesPaymentsMap[r.customer_id] || 0) + r.total; });
        db.prepare(`
            SELECT customer_id, SUM(amount) as total 
            FROM treasury_transactions
            WHERE type = 'income'
            AND COALESCE(related_type, '') != 'purchase_return'
            AND transaction_date > ?
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futureSalesPaymentsMap[r.customer_id] = (futureSalesPaymentsMap[r.customer_id] || 0) + r.total; });

        // Batch: Future purchase payments per supplier
        const futurePurchasePaymentsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(amount) as total 
            FROM treasury_transactions
            WHERE type = 'expense'
            AND COALESCE(related_type, '') != 'sales_return'
            AND transaction_date > ?
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futurePurchasePaymentsMap[r.customer_id] = r.total; });

        // Batch: Future sales returns per customer
        const futureSalesReturnsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_returns 
            WHERE return_date > ?
            GROUP BY customer_id
        `).all(futureDate).forEach(r => { futureSalesReturnsMap[r.customer_id] = r.total; });

        // Batch: Future purchase returns per supplier
        const futurePurchaseReturnsMap = {};
        db.prepare(`
            SELECT supplier_id as customer_id, SUM(total_amount) as total 
            FROM purchase_returns 
            WHERE return_date > ?
            GROUP BY supplier_id
        `).all(futureDate).forEach(r => { futurePurchaseReturnsMap[r.customer_id] = r.total; });

        // Batch: Period sales per customer
        const periodSalesMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date >= ? AND invoice_date <= ?
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesMap[r.customer_id] = r.total; });

        // Batch: Period purchases per supplier
        const periodPurchasesMap = {};
        db.prepare(`
            SELECT supplier_id, SUM(total_amount) as total 
            FROM purchase_invoices 
            WHERE invoice_date >= ? AND invoice_date <= ?
            GROUP BY supplier_id
        `).all(sDate, eDate).forEach(r => { periodPurchasesMap[r.supplier_id] = r.total; });

        // Batch: Period sales payments per customer
        const periodSalesPaymentsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(paid_amount) as total 
            FROM sales_invoices 
            WHERE invoice_date >= ? AND invoice_date <= ?
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesPaymentsMap[r.customer_id] = (periodSalesPaymentsMap[r.customer_id] || 0) + r.total; });
        db.prepare(`
            SELECT customer_id, SUM(amount) as total 
            FROM treasury_transactions
            WHERE type = 'income'
            AND COALESCE(related_type, '') != 'purchase_return'
            AND transaction_date >= ? AND transaction_date <= ?
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesPaymentsMap[r.customer_id] = (periodSalesPaymentsMap[r.customer_id] || 0) + r.total; });

        // Batch: Period purchase payments per supplier
        const periodPurchasePaymentsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(amount) as total 
            FROM treasury_transactions
            WHERE type = 'expense'
            AND COALESCE(related_type, '') != 'sales_return'
            AND transaction_date >= ? AND transaction_date <= ?
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodPurchasePaymentsMap[r.customer_id] = r.total; });

        // Batch: Period sales returns per customer
        const periodSalesReturnsMap = {};
        db.prepare(`
            SELECT customer_id, SUM(total_amount) as total 
            FROM sales_returns 
            WHERE return_date >= ? AND return_date <= ?
            GROUP BY customer_id
        `).all(sDate, eDate).forEach(r => { periodSalesReturnsMap[r.customer_id] = r.total; });

        // Batch: Period purchase returns per supplier
        const periodPurchaseReturnsMap = {};
        db.prepare(`
            SELECT supplier_id as customer_id, SUM(total_amount) as total 
            FROM purchase_returns 
            WHERE return_date >= ? AND return_date <= ?
            GROUP BY supplier_id
        `).all(sDate, eDate).forEach(r => { periodPurchaseReturnsMap[r.customer_id] = r.total; });

        const report = customers.map(customer => {
            const futureSales = futureSalesMap[customer.id] || 0;
            const futurePurchases = futurePurchasesMap[customer.id] || 0;
            const futureSalesPayments = futureSalesPaymentsMap[customer.id] || 0;
            const futurePurchasePayments = futurePurchasePaymentsMap[customer.id] || 0;
            const futureSalesReturns = futureSalesReturnsMap[customer.id] || 0;
            const futurePurchaseReturns = futurePurchaseReturnsMap[customer.id] || 0;
            
            const periodSales = periodSalesMap[customer.id] || 0;
            const periodPurchases = periodPurchasesMap[customer.id] || 0;
            const periodSalesPayments = periodSalesPaymentsMap[customer.id] || 0;
            const periodPurchasePayments = periodPurchasePaymentsMap[customer.id] || 0;
            const periodSalesReturns = periodSalesReturnsMap[customer.id] || 0;
            const periodPurchaseReturns = periodPurchaseReturnsMap[customer.id] || 0;
            
            const futureIncreases = futureSales + futurePurchasePayments + futurePurchaseReturns;
            const futureDecreases = futurePurchases + futureSalesPayments + futureSalesReturns;
            let closingBalance = customer.current_balance - futureIncreases + futureDecreases;
            
            const periodIncreases = periodSales + periodPurchasePayments + periodPurchaseReturns;
            const periodDecreases = periodPurchases + periodSalesPayments + periodSalesReturns;
            let openingBalance = closingBalance - periodIncreases + periodDecreases;
                
            let debitAmount = 0;
            let creditAmount = 0;
            
            if (customer.type === 'customer') {
                debitAmount = periodSales;
                creditAmount = periodSalesPayments + periodSalesReturns;
            } else if (customer.type === 'supplier') {
                debitAmount = periodPurchasePayments + periodPurchaseReturns;
                creditAmount = periodPurchases;
            } else {
                // Both
                debitAmount = periodSales + periodPurchasePayments + periodPurchaseReturns;
                creditAmount = periodSalesPayments + periodPurchases + periodSalesReturns;
            }
            
            return {
                ...customer,
                openingBalance,
                closingBalance,
                debitAmount,
                creditAmount
            };
        });
        
        return report;
        } catch (error) {
            console.error('[get-debtor-creditor-report] Error:', error);
            return [];
        }
    });

    ipcMain.handle('add-customer', (event, customer) => {
        const denied = requirePermission('customers', 'add');
        if (denied) return denied;
        try {
            const nextCode = db.prepare('SELECT COALESCE(MAX(code), 0) + 1 AS next FROM customers').get().next;
            customer.code = nextCode;
            customer.balance = customer.opening_balance;
            const stmt = db.prepare('INSERT INTO customers (name, phone, address, balance, opening_balance, type, code) VALUES (@name, @phone, @address, @balance, @opening_balance, @type, @code)');
            const info = stmt.run(customer);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-customer', (event, customer) => {
        const denied = requirePermission('customers', 'edit');
        if (denied) return denied;
        try {
            const existing = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customer.id);
            const oldOpening = existing ? (existing.opening_balance || 0) : 0;
            const newOpening = customer.opening_balance || 0;
            const diff = newOpening - oldOpening;
            const stmt = db.prepare('UPDATE customers SET name = @name, phone = @phone, address = @address, opening_balance = @opening_balance, balance = balance + @diff, type = @type WHERE id = @id');
            stmt.run({ ...customer, diff });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-customer', (event, id) => {
        const denied = requirePermission('customers', 'delete');
        if (denied) return denied;
        try {
            db.prepare('DELETE FROM customers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
