const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    ipcMain.handle('get-invoice-with-details', (event, { id, type }) => {
        try {
            const isSales = type === 'sales';
            const invoiceTable = isSales ? 'sales_invoices' : 'purchase_invoices';
            const detailsTable = isSales ? 'sales_invoice_details' : 'purchase_invoice_details';

            if (isSales) {
                console.log(`[sales] get-invoice-with-details id=${id}`);
            }
            
            const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
            if (!invoice) return null;

            const details = db.prepare(`
                SELECT d.*, i.name as item_name, i.stock_quantity as current_stock 
                FROM ${detailsTable} d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(id);

            return { ...invoice, items: details };
        } catch (error) {
            console.error('[get-invoice-with-details] Error:', error);
            return null;
        }
    });

    // --- Helper: Get Next Invoice Number ---
    ipcMain.handle('get-next-invoice-number', (event, type) => {
        try {
            let table, prefix;
            if (type === 'sales') {
                table = 'sales_invoices';
                prefix = 'SL';
            } else if (type === 'purchase') {
                table = 'purchase_invoices';
                prefix = 'PC';
            } else if (type === 'sales_return') {
                table = 'sales_returns';
                prefix = 'SR';
            } else if (type === 'purchase_return') {
                table = 'purchase_returns';
                prefix = 'PR';
            } else {
                // Default fallback
                table = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
                prefix = type === 'sales' ? 'SL' : 'PC';
            }

            const numberField = (type === 'sales_return' || type === 'purchase_return') ? 'return_number' : 'invoice_number';
            const lastInvoice = db.prepare(`SELECT ${numberField} FROM ${table} ORDER BY id DESC LIMIT 1`).get();
            let nextNumber = 1;
            if (lastInvoice && lastInvoice[numberField]) {
                const numericPart = lastInvoice[numberField].replace(/[^0-9]/g, '');
                if (numericPart) {
                    nextNumber = parseInt(numericPart, 10) + 1;
                }
            }
            return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
        } catch (error) {
            return '1';
        }
    });

    // Get invoice items with already-returned quantities
    ipcMain.handle('get-invoice-items-for-return', (event, { invoiceId, type }) => {
        try {
            if (type === 'sales') {
                const items = db.prepare(`
                    SELECT d.*, i.name as item_name, u.name as unit_name,
                        COALESCE((
                            SELECT SUM(srd.quantity)
                            FROM sales_return_details srd
                            JOIN sales_returns sr ON srd.return_id = sr.id
                            WHERE sr.original_invoice_id = d.invoice_id AND srd.item_id = d.item_id
                        ), 0) as returned_quantity
                    FROM sales_invoice_details d
                    LEFT JOIN items i ON d.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE d.invoice_id = ?
                `).all(invoiceId);
                return { success: true, items };
            } else {
                const items = db.prepare(`
                    SELECT d.*, i.name as item_name, u.name as unit_name,
                        COALESCE((
                            SELECT SUM(prd.quantity)
                            FROM purchase_return_details prd
                            JOIN purchase_returns pr ON prd.return_id = pr.id
                            WHERE pr.original_invoice_id = d.invoice_id AND prd.item_id = d.item_id
                        ), 0) as returned_quantity
                    FROM purchase_invoice_details d
                    LEFT JOIN items i ON d.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE d.invoice_id = ?
                `).all(invoiceId);
                return { success: true, items };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get specific invoice details
    ipcMain.handle('get-sales-invoice-details', (event, invoiceId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM sales_invoice_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(invoiceId);
        } catch (error) {
            console.error('[get-sales-invoice-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-purchase-invoice-details', (event, invoiceId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM purchase_invoice_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.invoice_id = ?
            `).all(invoiceId);
        } catch (error) {
            console.error('[get-purchase-invoice-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-sales-return-details', (event, returnId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM sales_return_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.return_id = ?
            `).all(returnId);
        } catch (error) {
            console.error('[get-sales-return-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-purchase-return-details', (event, returnId) => {
        try {
            return db.prepare(`
                SELECT d.*, i.name as item_name
                FROM purchase_return_details d
                LEFT JOIN items i ON d.item_id = i.id
                WHERE d.return_id = ?
            `).all(returnId);
        } catch (error) {
            console.error('[get-purchase-return-details] Error:', error);
            return [];
        }
    });

    ipcMain.handle('delete-invoice', (event, { id, type }) => {
        const page = type === 'sales' ? 'sales' : 'purchases';
        const denied = requirePermission(page, 'delete');
        if (denied) return denied;
        const isSales = type === 'sales';
        const invoiceTable = isSales ? 'sales_invoices' : 'purchase_invoices';
        const detailsTable = isSales ? 'sales_invoice_details' : 'purchase_invoice_details';
        const personIdField = isSales ? 'customer_id' : 'supplier_id';

        const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
        if (!invoice) return { success: false, error: 'الفاتورة غير موجودة أو تم حذفها من قبل' };

        const returnsTable = isSales ? 'sales_returns' : 'purchase_returns';
        const hasReturns = db.prepare(`SELECT COUNT(*) as count FROM ${returnsTable} WHERE original_invoice_id = ?`).get(id).count > 0;
        if (hasReturns) {
            return {
                success: false,
                error: 'لا يمكن حذف هذه الفاتورة لوجود مرتجعات (فواتير إرجاع) مرتبطة بها. يرجى حذف المرتجعات الخاصة بها أولاً.'
            };
        }

        const details = db.prepare(`SELECT * FROM ${detailsTable} WHERE invoice_id = ?`).all(id);
        const previousCostsByItem = new Map();

        if (!isSales) {
            const quantitiesByItem = new Map();
            details.forEach((item) => {
                const itemId = Number(item.item_id);
                if (!Number.isFinite(itemId)) return;
                quantitiesByItem.set(itemId, (quantitiesByItem.get(itemId) || 0) + (Number(item.quantity) || 0));
                if (!previousCostsByItem.has(itemId) && Number.isFinite(Number(item.previous_cost_price))) {
                    previousCostsByItem.set(itemId, Number(item.previous_cost_price));
                }
            });

            const getItemStock = db.prepare('SELECT name, stock_quantity FROM items WHERE id = ?');
            for (const [itemId, quantityToRemove] of quantitiesByItem.entries()) {
                const currentItem = getItemStock.get(itemId);
                const currentStock = Number(currentItem?.stock_quantity) || 0;
                if (quantityToRemove > currentStock) {
                    const itemName = currentItem?.name || `#${itemId}`;
                    return {
                        success: false,
                        error: `لا يمكن حذف فاتورة المشتريات لأن الصنف "${itemName}" المتاح حالياً ${currentStock} فقط، بينما حذف الفاتورة سيخصم ${quantityToRemove}. يبدو أن جزءاً من هذه الكمية تم بيعه أو استخدامه.`
                    };
                }
            }
        }

        const transaction = db.transaction(() => {
            const restorePurchaseItemCost = !isSales ? db.prepare(`
                SELECT pid.cost_price
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
                WHERE pid.item_id = ? AND pid.invoice_id != ?
                ORDER BY pi.invoice_date DESC, pi.id DESC, pid.id DESC
                LIMIT 1
            `) : null;
            const getOpeningItemCost = !isSales ? db.prepare(`
                SELECT cost_price
                FROM opening_balances
                WHERE item_id = ?
                ORDER BY id DESC
                LIMIT 1
            `) : null;
            const updateItemCostPrice = !isSales ? db.prepare('UPDATE items SET cost_price = ? WHERE id = ?') : null;

            // 1. Reverse Stock
            for (const item of details) {
                if (isSales) {
                    // Sales reduced stock, so add it back
                    db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?').run(item.quantity, item.item_id);
                } else {
                    // Purchase added stock, so remove it
                    db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?').run(item.quantity, item.item_id);
                }
            }

            if (!isSales) {
                const itemIds = new Set(details.map((item) => Number(item.item_id)).filter((itemId) => Number.isFinite(itemId)));
                for (const itemId of itemIds) {
                    const latestPurchase = restorePurchaseItemCost.get(itemId, id);
                    const openingCost = getOpeningItemCost.get(itemId);
                    const nextCost = Number.isFinite(Number(latestPurchase?.cost_price))
                        ? Number(latestPurchase.cost_price)
                        : previousCostsByItem.has(itemId)
                            ? previousCostsByItem.get(itemId)
                            : Number.isFinite(Number(openingCost?.cost_price))
                                ? Number(openingCost.cost_price)
                                : null;
                    if (nextCost !== null) {
                        updateItemCostPrice.run(nextCost, itemId);
                    }
                }
            }

            // 2. Reverse Balance
            if (isSales) {
                const salesBalanceDelta = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0);
                if (salesBalanceDelta !== 0) {
                    db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(salesBalanceDelta, invoice[personIdField]);
                }
            } else {
                const purchaseBalanceDelta = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0);
                if (purchaseBalanceDelta !== 0) {
                    db.prepare('UPDATE customers SET balance = balance + ? WHERE id = ?').run(purchaseBalanceDelta, invoice[personIdField]);
                }
            }

            // 3. Reverse Treasury (Delete the treasury transaction if any exists)
            db.prepare('DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = ?').run(id, type);

            // 4. Delete Details
            db.prepare(`DELETE FROM ${detailsTable} WHERE invoice_id = ?`).run(id);

            // 5. Hard Delete Invoice
            db.prepare(`DELETE FROM ${invoiceTable} WHERE id = ?`).run(id);
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error(error);
            if (String(error?.message || '').includes('negative stock_quantity')) {
                return {
                    success: false,
                    error: 'لا يمكن إتمام الحذف لأن العملية ستجعل رصيد أحد الأصناف في المخزون بالسالب. راجع حركات البيع والمرتجعات المرتبطة بهذه الفاتورة أولاً.'
                };
            }
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
