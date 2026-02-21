const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // --- Purchase Invoices Handlers ---

    ipcMain.handle('get-purchase-invoices', () => {
        try {
            return db.prepare(`
                SELECT pi.*, c.name as supplier_name 
                FROM purchase_invoices pi
                LEFT JOIN customers c ON pi.supplier_id = c.id
                ORDER BY pi.id DESC
            `).all();
        } catch (error) {
            console.error('[get-purchase-invoices] Error:', error);
            return [];
        }
    });

    ipcMain.handle('save-purchase-invoice', (event, invoiceData) => {
        const denied = requirePermission('purchases', 'add');
        if (denied) return denied;
        const { supplier_id, invoice_number, invoice_date, notes, items, payment_type } = invoiceData;
        
        let paid_amount = 0;
        let remaining_amount = 0;

        // Calculate total amount first
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }

        if (payment_type === 'cash') {
            paid_amount = totalAmount;
            remaining_amount = 0;
        } else {
            paid_amount = 0;
            remaining_amount = totalAmount;
        }

        const insertInvoice = db.prepare(`
            INSERT INTO purchase_invoices (supplier_id, invoice_number, invoice_date, total_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@supplier_id, @invoice_number, @invoice_date, @total_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO purchase_invoice_details (invoice_id, item_id, quantity, cost_price, total_price)
            VALUES (@invoice_id, @item_id, @quantity, @cost_price, @total_price)
        `);

        const updateItemStock = db.prepare(`
            UPDATE items 
            SET stock_quantity = stock_quantity + @quantity,
                cost_price = @cost_price 
            WHERE id = @item_id
        `);

        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('expense', @amount, @date, @description, @invoice_id, 'purchase')
        `);

        const updateSupplierBalance = db.prepare(`
            UPDATE customers 
            SET balance = balance + @amount 
            WHERE id = @id
        `);

        const transaction = db.transaction((data) => {
            const info = insertInvoice.run({
                supplier_id: data.supplier_id,
                invoice_number: data.invoice_number,
                invoice_date: data.invoice_date,
                total_amount: totalAmount,
                paid_amount: paid_amount,
                remaining_amount: remaining_amount,
                payment_type: data.payment_type,
                notes: data.notes
            });
            const invoiceId = info.lastInsertRowid;

            for (const item of data.items) {
                insertDetail.run({
                    invoice_id: invoiceId,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    total_price: item.total_price
                });

                // Update item stock and cost price
                updateItemStock.run({
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    item_id: item.item_id
                });
            }

            if (data.payment_type === 'cash') {
                // Add Treasury Transaction (Expense)
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.invoice_date,
                    description: `فاتورة شراء رقم ${data.invoice_number || invoiceId} (كاش)`,
                    invoice_id: invoiceId
                });
            } else {
                // Update Supplier Balance (Credit)
                updateSupplierBalance.run({
                    amount: totalAmount,
                    id: data.supplier_id
                });
            }

            return invoiceId;
        });

        try {
            const invoiceId = transaction(invoiceData);
            return { success: true, invoiceId };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-purchase-invoice', (event, invoiceData) => {
        const denied = requirePermission('purchases', 'edit');
        if (denied) return denied;
        const { id, supplier_id, invoice_number, invoice_date, notes, items, payment_type } = invoiceData;
        
        const oldInvoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id);
        const oldDetails = db.prepare('SELECT * FROM purchase_invoice_details WHERE invoice_id = ?').all(id);

        if (!oldInvoice) return { success: false, error: 'Invoice not found' };

        let totalAmount = 0;
        for (const item of items) totalAmount += item.total_price;
        
        let paid_amount = 0;
        let remaining_amount = 0;
        if (payment_type === 'cash') {
            paid_amount = totalAmount;
            remaining_amount = 0;
        } else {
            paid_amount = 0;
            remaining_amount = totalAmount;
        }

        const transaction = db.transaction(() => {
            // --- REVERSE OLD ---
            // Reverse Stock (Remove purchased items)
            for (const item of oldDetails) {
                db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.item_id);
            }
            // Reverse Balance (Subtract old credit)
            if (oldInvoice.remaining_amount > 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldInvoice.remaining_amount, oldInvoice.supplier_id);
            }
            // Delete Treasury
            if (oldInvoice.paid_amount > 0) {
                db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'purchase'").run(id);
            }
            // Delete Details
            db.prepare('DELETE FROM purchase_invoice_details WHERE invoice_id = ?').run(id);

            // --- APPLY NEW ---
            db.prepare(`
                UPDATE purchase_invoices 
                SET supplier_id = @supplier_id, invoice_number = @invoice_number, invoice_date = @invoice_date, 
                    total_amount = @total_amount, paid_amount = @paid_amount, remaining_amount = @remaining_amount, 
                    payment_type = @payment_type, notes = @notes
                WHERE id = @id
            `).run({
                id, supplier_id, invoice_number, invoice_date, total_amount: totalAmount, paid_amount, remaining_amount, payment_type, notes
            });

            const insertDetail = db.prepare(`
                INSERT INTO purchase_invoice_details (invoice_id, item_id, quantity, cost_price, total_price)
                VALUES (@invoice_id, @item_id, @quantity, @cost_price, @total_price)
            `);
            const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity + @quantity, cost_price = @cost_price WHERE id = @item_id');

            for (const item of items) {
                insertDetail.run({
                    invoice_id: id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price,
                    total_price: item.total_price
                });
                updateItemStock.run({ quantity: item.quantity, cost_price: item.cost_price, item_id: item.item_id });
            }

            if (remaining_amount > 0) {
                db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(remaining_amount, supplier_id);
            }

            if (paid_amount > 0) {
                db.prepare(`
                    INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                    VALUES ('expense', @amount, @date, @description, @invoice_id, 'purchase')
                `).run({
                    amount: paid_amount,
                    date: invoice_date,
                    description: `تعديل فاتورة شراء رقم ${invoice_number || id} (كاش)`,
                    invoice_id: id
                });
            }
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
