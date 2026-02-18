const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // =============================================
    // === Purchase Returns Handlers (مردودات المشتريات) ===
    // =============================================

    // Get all purchase returns
    ipcMain.handle('get-purchase-returns', () => {
        return db.prepare(`
            SELECT pr.*, c.name as supplier_name, pi.invoice_number as original_invoice_number
            FROM purchase_returns pr
            LEFT JOIN customers c ON pr.supplier_id = c.id
            LEFT JOIN purchase_invoices pi ON pr.original_invoice_id = pi.id
            ORDER BY pr.id DESC
        `).all();
    });

    // Get purchase invoices for a specific supplier (for returns)
    ipcMain.handle('get-supplier-purchase-invoices', (event, supplierId) => {
        return db.prepare(`
            SELECT pi.*, c.name as supplier_name
            FROM purchase_invoices pi
            LEFT JOIN customers c ON pi.supplier_id = c.id
            WHERE pi.supplier_id = ?
            ORDER BY pi.invoice_date DESC
        `).all(supplierId);
    });

    // Save purchase return
    ipcMain.handle('save-purchase-return', (event, returnData) => {
        const { original_invoice_id, supplier_id, return_number, return_date, notes, items } = returnData;

        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }

        // Stock validation: prevent returning more than available in stock
        const getStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
        for (const item of items) {
            const dbItem = getStock.get(item.item_id);
            if (!dbItem) {
                return { success: false, error: `الصنف غير موجود (ID: ${item.item_id})` };
            }
            if (item.quantity > dbItem.stock_quantity) {
                return { success: false, error: `الصنف "${dbItem.name}": الكمية المطلوبة للإرجاع (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})` };
            }
        }

        const insertReturn = db.prepare(`
            INSERT INTO purchase_returns (return_number, original_invoice_id, supplier_id, return_date, total_amount, notes)
            VALUES (@return_number, @original_invoice_id, @supplier_id, @return_date, @total_amount, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO purchase_return_details (return_id, item_id, quantity, price, total_price)
            VALUES (@return_id, @item_id, @quantity, @price, @total_price)
        `);

        // Remove items from stock
        const updateItemStock = db.prepare(`
            UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id
        `);

        // Reduce supplier balance (we owe less)
        const updateSupplierBalance = db.prepare(`
            UPDATE customers SET balance = balance - @amount WHERE id = @id
        `);

        // Treasury income for cash purchases
        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('income', @amount, @date, @description, @invoice_id, 'purchase_return')
        `);

        const transaction = db.transaction((data) => {
            const info = insertReturn.run({
                return_number: data.return_number,
                original_invoice_id: data.original_invoice_id,
                supplier_id: data.supplier_id,
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

                // Remove items from stock
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            // Check original invoice payment type
            const originalInvoice = db.prepare('SELECT payment_type FROM purchase_invoices WHERE id = ?').get(data.original_invoice_id);
            
            if (originalInvoice && originalInvoice.payment_type === 'cash') {
                // Refund to treasury
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.return_date,
                    description: `مردودات مشتريات - فاتورة رقم ${data.return_number} (مرتجع من فاتورة شراء)`,
                    invoice_id: returnId
                });
            } else {
                // Reduce supplier balance
                updateSupplierBalance.run({
                    amount: totalAmount,
                    id: data.supplier_id
                });
            }

            return returnId;
        });

        try {
            const returnId = transaction(returnData);
            return { success: true, returnId };
        } catch (error) {
            console.error('[save-purchase-return] Error:', error);
            return { success: false, error: error.message };
        }
    });

    // Delete purchase return
    ipcMain.handle('delete-purchase-return', (event, returnId) => {
        try {
            const returnRecord = db.prepare('SELECT * FROM purchase_returns WHERE id = ?').get(returnId);
            if (!returnRecord) return { success: false, error: 'المرتجع غير موجود' };

            const details = db.prepare('SELECT * FROM purchase_return_details WHERE return_id = ?').all(returnId);

            const transaction = db.transaction(() => {
                // Reverse stock changes (add back)
                const updateStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity WHERE id = @item_id');
                for (const detail of details) {
                    updateStock.run({ quantity: detail.quantity, item_id: detail.item_id });
                }

                // Reverse balance changes
                const originalInvoice = db.prepare('SELECT payment_type FROM purchase_invoices WHERE id = ?').get(returnRecord.original_invoice_id);
                if (originalInvoice && originalInvoice.payment_type === 'cash') {
                    db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'purchase_return'").run(returnId);
                } else {
                    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(returnRecord.total_amount, returnRecord.supplier_id);
                }

                // Delete return and its details
                db.prepare('DELETE FROM purchase_return_details WHERE return_id = ?').run(returnId);
                db.prepare('DELETE FROM purchase_returns WHERE id = ?').run(returnId);
            });

            transaction();
            return { success: true };
        } catch (error) {
            console.error('[delete-purchase-return] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
