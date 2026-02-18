const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // =============================================
    // === Sales Returns Handlers (مردودات المبيعات) ===
    // =============================================

    // Get all sales returns
    ipcMain.handle('get-sales-returns', () => {
        return db.prepare(`
            SELECT sr.*, c.name as customer_name, si.invoice_number as original_invoice_number
            FROM sales_returns sr
            LEFT JOIN customers c ON sr.customer_id = c.id
            LEFT JOIN sales_invoices si ON sr.original_invoice_id = si.id
            ORDER BY sr.id DESC
        `).all();
    });

    // Get sales invoices for a specific customer (for returns)
    ipcMain.handle('get-customer-sales-invoices', (event, customerId) => {
        return db.prepare(`
            SELECT si.*, c.name as customer_name
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE si.customer_id = ?
            ORDER BY si.invoice_date DESC
        `).all(customerId);
    });

    // Save sales return
    ipcMain.handle('save-sales-return', (event, returnData) => {
        const { original_invoice_id, customer_id, return_number, return_date, notes, items } = returnData;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }

        const insertReturn = db.prepare(`
            INSERT INTO sales_returns (return_number, original_invoice_id, customer_id, return_date, total_amount, notes)
            VALUES (@return_number, @original_invoice_id, @customer_id, @return_date, @total_amount, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO sales_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        // Return items to stock
        const updateItemStock = db.prepare(`
            UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id
        `);

        // Reduce customer balance (they owe less)
        const updateCustomerBalance = db.prepare(`
            UPDATE customers SET balance = balance - @amount WHERE id = @id
        `);

        // Treasury refund for cash sales
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('expense', @amount, @date, @description, @invoice_id, 'sales_return')
        `);

        const transaction = db.transaction((data) => {
            const info = insertReturn.run({
                return_number: data.return_number,
                original_invoice_id: data.original_invoice_id,
                customer_id: data.customer_id,
                return_date: data.return_date,
                total_amount: totalAmount,
                notes: data.notes
            });
            const returnId = info.lastInsertRowid;

            for (const item of data.items) {
                insertDetail.run({
                    return_id: returnId,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    price: item.price,
                    total_price: item.total_price
                });

                // Return items to stock
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            // Check original invoice payment type
            const originalInvoice = db.prepare('SELECT payment_type FROM sales_invoices WHERE id = ?').get(data.original_invoice_id);
            
            if (originalInvoice && originalInvoice.payment_type === 'cash') {
                // Refund from treasury
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.return_date,
                    description: `مردودات مبيعات - فاتورة رقم ${data.return_number} (مرتجع من فاتورة بيع)`,
                    invoice_id: returnId
                });
            } else {
                // Reduce customer balance
                updateCustomerBalance.run({
                    amount: totalAmount,
                    id: data.customer_id
                });
            }

            return returnId;
        });

        try {
            const returnId = transaction(returnData);
            return { success: true, returnId };
        } catch (error) {
            console.error('[save-sales-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete sales return
    ipcMain.handle('delete-sales-return', (event, returnId) => {
        try {
            const returnRecord = db.prepare('SELECT * FROM sales_returns WHERE id = ?').get(returnId);
            if (!returnRecord) return { success: false, error: 'المرتجع غير موجود' };

            const details = db.prepare('SELECT * FROM sales_return_details WHERE return_id = ?').all(returnId);

            const transaction = db.transaction(() => {
                // Reverse stock changes
                const updateStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');
                for (const detail of details) {
                    updateStock.run({ quantity: detail.quantity, item_id: detail.item_id });
                }

                // Reverse balance changes
                const originalInvoice = db.prepare('SELECT payment_type FROM sales_invoices WHERE id = ?').get(returnRecord.original_invoice_id);
                if (originalInvoice && originalInvoice.payment_type === 'cash') {
                    // Delete treasury transaction
                    db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'sales_return'").run(returnId);
                } else {
                    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(returnRecord.total_amount, returnRecord.customer_id);
                }

                // Delete return and its details
                db.prepare('DELETE FROM sales_return_details WHERE return_id = ?').run(returnId);
                db.prepare('DELETE FROM sales_returns WHERE id = ?').run(returnId);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error('[delete-sales-return] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
