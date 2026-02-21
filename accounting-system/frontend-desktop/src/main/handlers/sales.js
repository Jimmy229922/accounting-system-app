const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // --- Sales Invoices Handlers ---

    ipcMain.handle('get-sales-invoices', () => {
        try {
            return db.prepare(`
                SELECT si.*, c.name as customer_name 
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                ORDER BY si.id DESC
            `).all();
        } catch (error) {
            console.error('[get-sales-invoices] Error:', error);
            return [];
        }
    });

    ipcMain.handle('save-sales-invoice', (event, invoiceData) => {
        const denied = requirePermission('sales', 'add');
        if (denied) return denied;
        const { customer_id, invoice_date, notes, items, payment_type } = invoiceData;
        let { invoice_number } = invoiceData;

        // Ensure invoice_number is always present (avoid empty/null numbers that bypass duplicate checks)
        if (!invoice_number || String(invoice_number).trim() === '') {
            const result = db.prepare('SELECT MAX(id) as maxId FROM sales_invoices').get();
            invoice_number = String((result.maxId || 0) + 1);
        }

        console.log(`[sales] save-sales-invoice invoice_number=${invoice_number} customer_id=${customer_id} items=${items?.length ?? 0}`);
        
        // Check for duplicate invoice number
        const existing = db.prepare('SELECT id FROM sales_invoices WHERE invoice_number = ?').get(invoice_number);
        if (existing) {
            console.log(`[sales] save-sales-invoice rejected duplicate invoice_number=${invoice_number} existing_id=${existing.id}`);
            return { success: false, error: 'رقم الفاتورة موجود مسبقاً' };
        }

        // Stock validation: prevent selling more than available
        const getStock = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
        for (const item of items) {
            const dbItem = getStock.get(item.item_id);
            if (!dbItem) {
                return { success: false, error: `الصنف غير موجود (ID: ${item.item_id})` };
            }
            if (item.quantity > dbItem.stock_quantity) {
                return { success: false, error: `الصنف "${dbItem.name}": الكمية المطلوبة (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})` };
            }
        }

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
            INSERT INTO sales_invoices (customer_id, invoice_number, invoice_date, total_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@customer_id, @invoice_number, @invoice_date, @total_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
        `);

        const insertDetail = db.prepare(`
            INSERT INTO sales_invoice_details (invoice_id, item_id, quantity, sale_price, total_price)
            VALUES (@invoice_id, @item_id, @quantity, @sale_price, @total_price)
        `);

        const updateItemStock = db.prepare(`
            UPDATE items 
            SET stock_quantity = stock_quantity - @quantity
            WHERE id = @item_id
        `);

        const insertTreasuryTransaction = db.prepare(`
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
            VALUES ('income', @amount, @date, @description, @invoice_id, 'sales')
        `);

        const updateCustomerBalance = db.prepare(`
            UPDATE customers 
            SET balance = balance + @amount 
            WHERE id = @id
        `);

        const transaction = db.transaction((data) => {
            const info = insertInvoice.run({
                customer_id: data.customer_id,
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
                    sale_price: item.sale_price,
                    total_price: item.total_price
                });

                // Update item stock (subtract quantity)
                updateItemStock.run({
                    quantity: item.quantity,
                    item_id: item.item_id
                });
            }

            if (data.payment_type === 'cash') {
                // Add Treasury Transaction (Income)
                insertTreasuryTransaction.run({
                    amount: totalAmount,
                    date: data.invoice_date,
                    description: `فاتورة بيع رقم ${data.invoice_number || invoiceId} (كاش)`,
                    invoice_id: invoiceId
                });
            } else {
                // Update Customer Balance (Credit)
                updateCustomerBalance.run({
                    amount: totalAmount,
                    id: data.customer_id
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

    ipcMain.handle('update-sales-invoice', (event, invoiceData) => {
        const denied = requirePermission('sales', 'edit');
        if (denied) return denied;
        const { id, customer_id, invoice_number, invoice_date, notes, items, payment_type } = invoiceData;

        console.log(`[sales] update-sales-invoice id=${id} invoice_number=${invoice_number} customer_id=${customer_id} items=${items?.length ?? 0}`);
        
        // Check for duplicate invoice number (excluding current invoice)
        const existing = db.prepare('SELECT id FROM sales_invoices WHERE invoice_number = ? AND id != ?').get(invoice_number, id);
        if (existing) {
            console.log(`[sales] update-sales-invoice rejected duplicate invoice_number=${invoice_number} existing_id=${existing.id} current_id=${id}`);
            return { success: false, error: 'رقم الفاتورة موجود مسبقاً' };
        }

        // 1. Fetch Old Data
        const oldInvoice = db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(id);
        const oldDetails = db.prepare('SELECT * FROM sales_invoice_details WHERE invoice_id = ?').all(id);

        if (!oldInvoice) return { success: false, error: 'Invoice not found' };

        // Calculate new totals
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.total_price;
        }
        
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
            // --- REVERSE OLD EFFECTS ---
            
            // Reverse Stock (Add back sold items)
            for (const item of oldDetails) {
                db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.item_id);
            }

            // Stock validation after reversal: check new quantities fit
            const getStockForUpdate = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?');
            for (const item of items) {
                const dbItem = getStockForUpdate.get(item.item_id);
                if (!dbItem) {
                    throw new Error(`الصنف غير موجود (ID: ${item.item_id})`);
                }
                if (item.quantity > dbItem.stock_quantity) {
                    throw new Error(`الصنف "${dbItem.name}": الكمية المطلوبة (${item.quantity}) أكبر من المتاح (${dbItem.stock_quantity})`);
                }
            }

            // Reverse Balance (Subtract old debt)
            if (oldInvoice.remaining_amount > 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldInvoice.remaining_amount, oldInvoice.customer_id);
            }

            // Delete old Treasury Transaction
            if (oldInvoice.paid_amount > 0) {
                db.prepare("DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = 'sales'").run(id);
            }

            // Delete old Details
            db.prepare('DELETE FROM sales_invoice_details WHERE invoice_id = ?').run(id);

            // --- APPLY NEW EFFECTS ---

            // Update Invoice Header
            db.prepare(`
                UPDATE sales_invoices 
                SET customer_id = @customer_id, invoice_number = @invoice_number, invoice_date = @invoice_date, 
                    total_amount = @total_amount, paid_amount = @paid_amount, remaining_amount = @remaining_amount, 
                    payment_type = @payment_type, notes = @notes
                WHERE id = @id
            `).run({
                id, customer_id, invoice_number, invoice_date, total_amount: totalAmount, paid_amount, remaining_amount, payment_type, notes
            });

            // Insert New Details & Update Stock
            const insertDetail = db.prepare(`
                INSERT INTO sales_invoice_details (invoice_id, item_id, quantity, sale_price, total_price)
                VALUES (@invoice_id, @item_id, @quantity, @sale_price, @total_price)
            `);
            const updateItemStock = db.prepare('UPDATE items SET stock_quantity = stock_quantity - @quantity WHERE id = @item_id');

            for (const item of items) {
                insertDetail.run({
                    invoice_id: id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    sale_price: item.sale_price,
                    total_price: item.total_price
                });
                updateItemStock.run({ quantity: item.quantity, item_id: item.item_id });
            }

            // Update Balance (Add new debt)
            if (remaining_amount > 0) {
                db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(remaining_amount, customer_id);
            }

            // Add Treasury Transaction (Income)
            if (paid_amount > 0) {
                db.prepare(`
                    INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type)
                    VALUES ('income', @amount, @date, @description, @invoice_id, 'sales')
                `).run({
                    amount: paid_amount,
                    date: invoice_date,
                    description: `تعديل فاتورة بيع رقم ${invoice_number || id} (كاش)`,
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
