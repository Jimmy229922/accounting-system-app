const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // --- Customers Handlers ---

    ipcMain.handle('get-customers', () => {
        return db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    });

    ipcMain.handle('get-debtor-creditor-report', (event, { startDate, endDate }) => {
        const customers = db.prepare('SELECT id, name, type, balance as current_balance, phone FROM customers ORDER BY name ASC').all();
        
        const report = customers.map(customer => {
            const sDate = startDate || '1900-01-01';
            const eDate = endDate || '9999-12-31';
            const futureDate = endDate || '9999-12-31';

            // Calculate movements AFTER endDate (Future)
            const futureSales = db.prepare(`
                SELECT SUM(total_amount) as total 
                FROM sales_invoices 
                WHERE customer_id = ? AND invoice_date > ? AND payment_type != 'cash'
            `).get(customer.id, futureDate).total || 0;
            
            const futurePurchases = db.prepare(`
                SELECT SUM(total_amount) as total 
                FROM purchase_invoices 
                WHERE supplier_id = ? AND invoice_date > ? AND payment_type != 'cash'
            `).get(customer.id, futureDate).total || 0;
            
            const futureSalesPayments = db.prepare(`
                SELECT SUM(amount) as total 
                FROM treasury_transactions 
                WHERE related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?) 
                AND related_type = 'sales' 
                AND transaction_date > ?
            `).get(customer.id, futureDate).total || 0;
            
            const futurePurchasePayments = db.prepare(`
                SELECT SUM(amount) as total 
                FROM treasury_transactions 
                WHERE related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?) 
                AND related_type = 'purchase' 
                AND transaction_date > ?
            `).get(customer.id, futureDate).total || 0;
            
            // Calculate movements DURING period
            const periodSales = db.prepare(`
                SELECT SUM(total_amount) as total 
                FROM sales_invoices 
                WHERE customer_id = ? AND invoice_date >= ? AND invoice_date <= ? AND payment_type != 'cash'
            `).get(customer.id, sDate, eDate).total || 0;
            
            const periodPurchases = db.prepare(`
                SELECT SUM(total_amount) as total 
                FROM purchase_invoices 
                WHERE supplier_id = ? AND invoice_date >= ? AND invoice_date <= ? AND payment_type != 'cash'
            `).get(customer.id, sDate, eDate).total || 0;
            
            const periodSalesPayments = db.prepare(`
                SELECT SUM(amount) as total 
                FROM treasury_transactions 
                WHERE related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?) 
                AND related_type = 'sales' 
                AND transaction_date >= ? AND transaction_date <= ?
            `).get(customer.id, sDate, eDate).total || 0;
            
            const periodPurchasePayments = db.prepare(`
                SELECT SUM(amount) as total 
                FROM treasury_transactions 
                WHERE related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?) 
                AND related_type = 'purchase' 
                AND transaction_date >= ? AND transaction_date <= ?
            `).get(customer.id, sDate, eDate).total || 0;
            
            // Closing Balance = Current - Future Increases + Future Decreases
            // Increases to Balance: Sales, Purchases
            // Decreases to Balance: Payments
            let closingBalance = customer.current_balance 
                - (futureSales + futurePurchases) 
                + (futureSalesPayments + futurePurchasePayments);
                
            // Opening Balance = Closing - Period Increases + Period Decreases
            let openingBalance = closingBalance 
                - (periodSales + periodPurchases) 
                + (periodSalesPayments + periodPurchasePayments);
                
            let debitAmount = 0;
            let creditAmount = 0;
            
            // Determine Debit/Credit for the period based on accounting logic
            // Customer: Debit = Sales, Credit = Payments
            // Supplier: Debit = Payments, Credit = Purchases
            
            if (customer.type === 'customer') {
                debitAmount = periodSales;
                creditAmount = periodSalesPayments;
            } else if (customer.type === 'supplier') {
                debitAmount = periodPurchasePayments;
                creditAmount = periodPurchases;
            } else {
                // Both
                debitAmount = periodSales + periodPurchasePayments;
                creditAmount = periodSalesPayments + periodPurchases;
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
    });

    ipcMain.handle('add-customer', (event, customer) => {
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
        try {
            db.prepare('DELETE FROM customers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
