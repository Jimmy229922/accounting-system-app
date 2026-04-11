const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function getTreasuryVoucherPrefix(type) {
    if (type === 'income') return 'RCV';
    if (type === 'expense') return 'PAY';
    return null;
}

function getNextTreasuryVoucherNumberForType(type) {
    const prefix = getTreasuryVoucherPrefix(type);
    if (!prefix) return null;

    const maxResult = db.prepare(`
        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER)) as max_num
        FROM treasury_transactions
        WHERE type = @type
          AND voucher_number GLOB @pattern
    `).get({
        type,
        pattern: `${prefix}-[0-9]*`
    });

    const nextNumber = Number(maxResult?.max_num || 0) + 1;
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function register() {
    // --- Treasury Handlers ---

    ipcMain.handle('get-treasury-balance', () => {
        try {
            const income = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'income'").get().total || 0;
            const expense = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0;
            return income - expense;
        } catch (error) {
            console.error(error);
            return 0;
        }
    });

    ipcMain.handle('get-treasury-transactions', () => {
        try {
            return db.prepare('SELECT * FROM treasury_transactions ORDER BY transaction_date DESC, id DESC').all();
        } catch (error) {
            console.error('[get-treasury-transactions] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-next-treasury-voucher-number', (event, type) => {
        try {
            const voucher_number = getNextTreasuryVoucherNumberForType(type);
            if (!voucher_number) {
                return { success: false, error: 'Invalid treasury transaction type' };
            }
            return { success: true, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('add-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'add');
        if (denied) return denied;
        try {
            const { type, amount, date, description, customer_id } = transaction;
            const voucher_number = getNextTreasuryVoucherNumberForType(type);
            if (!voucher_number) {
                return { success: false, error: 'Invalid treasury transaction type' };
            }
            
            const stmt = db.prepare(`
                INSERT INTO treasury_transactions (type, amount, transaction_date, description, customer_id, voucher_number)
                VALUES (@type, @amount, @date, @description, @customer_id, @voucher_number)
            `);

            const updateBalance = db.prepare(`
                UPDATE customers 
                SET balance = balance + @amount 
                WHERE id = @id
            `);

            const tx = db.transaction(() => {
                stmt.run({ type, amount, date, description, customer_id, voucher_number });
                
                if (customer_id) {
                    updateBalance.run({ amount: -amount, id: customer_id });
                }
            });

            tx();
            return { success: true, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-treasury-transaction', (event, transaction) => {
        const denied = requirePermission('treasury', 'edit');
        if (denied) return denied;
        try {
            const stmt = db.prepare(`
                UPDATE treasury_transactions 
                SET type = @type, amount = @amount, transaction_date = @date, description = @description
                WHERE id = @id
            `);
            stmt.run(transaction);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-treasury-transaction', (event, id) => {
        const denied = requirePermission('treasury', 'delete');
        if (denied) return denied;
        const getTrans = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?');
        const deleteTrans = db.prepare('DELETE FROM treasury_transactions WHERE id = ?');
        
        // Sales Updates
        const updateSalesInvoice = db.prepare('UPDATE sales_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const updateCustomer = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');
        const getSalesInvoice = db.prepare('SELECT customer_id FROM sales_invoices WHERE id = ?');

        // Purchase Updates
        const updatePurchaseInvoice = db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const getPurchaseInvoice = db.prepare('SELECT supplier_id FROM purchase_invoices WHERE id = ?');

        const tx = db.transaction(() => {
            const trans = getTrans.get(id);
            if (!trans) return; // Already deleted

            // Handle Direct Payments (linked via customer_id)
            if (trans.customer_id) {
                // When payment was added, we subtracted amount from balance.
                // Now we add it back.
                updateCustomer.run({ amount: trans.amount, id: trans.customer_id });
            }

            if (trans.related_invoice_id) {
                if (trans.related_type === 'sales') {
                    // Revert Sales Payment
                    updateSalesInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getSalesInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.customer_id) {
                        updateCustomer.run({ amount: trans.amount, id: invoice.customer_id });
                    }
                } else if (trans.related_type === 'purchase') {
                    // Revert Purchase Payment
                    updatePurchaseInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getPurchaseInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.supplier_id) {
                        updateCustomer.run({ amount: trans.amount, id: invoice.supplier_id });
                    }
                }
            }

            deleteTrans.run(id);
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('search-treasury-by-voucher', (event, voucherNumber) => {
        try {
            const results = db.prepare(`
                SELECT t.*, c.name as customer_name
                FROM treasury_transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                WHERE t.voucher_number LIKE @search
                ORDER BY t.transaction_date DESC, t.id DESC
            `).all({ search: `%${voucherNumber}%` });
            return { success: true, results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
