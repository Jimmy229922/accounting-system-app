const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function toPositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calculateInvoiceFinancials({ subtotalAmount, discountType, discountValue, paidAmount }) {
    const subtotal = roundMoney(Math.max(Number(subtotalAmount) || 0, 0));
    const normalizedDiscountType = discountType === 'percent' ? 'percent' : 'amount';
    const rawDiscountValue = toPositiveNumber(discountValue);
    const normalizedDiscountValue = normalizedDiscountType === 'percent'
        ? Math.min(rawDiscountValue, 100)
        : rawDiscountValue;

    let discountAmount = normalizedDiscountType === 'percent'
        ? subtotal * (normalizedDiscountValue / 100)
        : normalizedDiscountValue;
    discountAmount = roundMoney(Math.min(Math.max(discountAmount, 0), subtotal));

    const totalAmount = roundMoney(Math.max(subtotal - discountAmount, 0));
    const paid = roundMoney(toPositiveNumber(paidAmount));
    const remaining = roundMoney(Math.max(totalAmount - paid, 0));
    const balanceDelta = roundMoney(totalAmount - paid);

    return {
        subtotal_amount: subtotal,
        discount_type: normalizedDiscountType,
        discount_value: roundMoney(normalizedDiscountValue),
        discount_amount: discountAmount,
        total_amount: totalAmount,
        paid_amount: paid,
        remaining_amount: remaining,
        balance_delta: balanceDelta
    };
}

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
        const { customer_id, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;
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

        let subtotalAmount = 0;
        for (const item of items) {
            subtotalAmount += Number(item.total_price) || 0;
        }

        const financials = calculateInvoiceFinancials({
            subtotalAmount,
            discountType: discount_type,
            discountValue: discount_value,
            paidAmount: paid_amount
        });

        const insertInvoice = db.prepare(`
            INSERT INTO sales_invoices (customer_id, invoice_number, invoice_date, total_amount, discount_type, discount_value, discount_amount, paid_amount, remaining_amount, payment_type, notes)
            VALUES (@customer_id, @invoice_number, @invoice_date, @total_amount, @discount_type, @discount_value, @discount_amount, @paid_amount, @remaining_amount, @payment_type, @notes)
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
            INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type, customer_id)
            VALUES ('income', @amount, @date, @description, @invoice_id, 'sales', @customer_id)
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
                total_amount: financials.total_amount,
                discount_type: financials.discount_type,
                discount_value: financials.discount_value,
                discount_amount: financials.discount_amount,
                paid_amount: financials.paid_amount,
                remaining_amount: financials.remaining_amount,
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

            if (financials.paid_amount > 0) {
                insertTreasuryTransaction.run({
                    amount: financials.paid_amount,
                    date: data.invoice_date,
                    description: `فاتورة بيع رقم ${data.invoice_number || invoiceId} (مدفوع ${financials.paid_amount.toFixed(2)})`,
                    invoice_id: invoiceId,
                    customer_id: data.customer_id
                });
            }

            if (financials.balance_delta !== 0) {
                updateCustomerBalance.run({
                    amount: financials.balance_delta,
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
        const { id, customer_id, invoice_number, invoice_date, notes, items, payment_type, discount_type, discount_value, paid_amount } = invoiceData;

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

        let subtotalAmount = 0;
        for (const item of items) {
            subtotalAmount += Number(item.total_price) || 0;
        }

        const financials = calculateInvoiceFinancials({
            subtotalAmount,
            discountType: discount_type,
            discountValue: discount_value,
            paidAmount: paid_amount
        });

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

            const oldBalanceDelta = roundMoney((Number(oldInvoice.total_amount) || 0) - (Number(oldInvoice.paid_amount) || 0));
            if (oldBalanceDelta !== 0) {
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(oldBalanceDelta, oldInvoice.customer_id);
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
                    total_amount = @total_amount, discount_type = @discount_type, discount_value = @discount_value, discount_amount = @discount_amount,
                    paid_amount = @paid_amount, remaining_amount = @remaining_amount, 
                    payment_type = @payment_type, notes = @notes
                WHERE id = @id
            `).run({
                id,
                customer_id,
                invoice_number,
                invoice_date,
                total_amount: financials.total_amount,
                discount_type: financials.discount_type,
                discount_value: financials.discount_value,
                discount_amount: financials.discount_amount,
                paid_amount: financials.paid_amount,
                remaining_amount: financials.remaining_amount,
                payment_type,
                notes
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

            if (financials.balance_delta !== 0) {
                db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(financials.balance_delta, customer_id);
            }

            // Add Treasury Transaction (Income)
            if (financials.paid_amount > 0) {
                db.prepare(`
                    INSERT INTO treasury_transactions (type, amount, transaction_date, description, related_invoice_id, related_type, customer_id)
                    VALUES ('income', @amount, @date, @description, @invoice_id, 'sales', @customer_id)
                `).run({
                    amount: financials.paid_amount,
                    date: invoice_date,
                    description: `تعديل فاتورة بيع رقم ${invoice_number || id} (مدفوع ${financials.paid_amount.toFixed(2)})`,
                    invoice_id: id,
                    customer_id
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
