const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { db } = require('../db');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { sanitizeSuggestedFileName } = require('./utils');

function register() {
    // --- Reports Handlers ---

    ipcMain.handle('get-all-reports', (event, filters) => {
        const { startDate, endDate, customerId, type } = filters;
        
        // Helper to build query parts
        const buildQuery = (table, typeLabel) => {
            const isReturn = typeLabel === 'sales_return' || typeLabel === 'purchase_return';
            const dateCol = isReturn ? 'return_date' : 'invoice_date';
            const numCol = isReturn ? 'return_number' : 'invoice_number';
            const joinCol = (typeLabel === 'sales' || typeLabel === 'sales_return') ? 'customer_id' : 'supplier_id';
            let sql = `
                SELECT 
                    '${typeLabel}' as type,
                    i.id,
                    i.${numCol} as invoice_number,
                    i.${dateCol} as invoice_date,
                    i.total_amount,
                    c.name as customer_name
                FROM ${table} i
                LEFT JOIN customers c ON i.${joinCol} = c.id
                WHERE 1=1
            `;
            
            if (startDate) {
                sql += ` AND i.${dateCol} >= @startDate`;
            }
            if (endDate) {
                sql += ` AND i.${dateCol} <= @endDate`;
            }
            if (customerId) {
                sql += ` AND i.${joinCol} = @customerId`;
            }
            return sql;
        };

        let queries = [];
        if (type === 'all' || type === 'sales') {
            queries.push(buildQuery('sales_invoices', 'sales'));
        }
        if (type === 'all' || type === 'purchase') {
            queries.push(buildQuery('purchase_invoices', 'purchase'));
        }
        if (type === 'all' || type === 'sales_return') {
            queries.push(buildQuery('sales_returns', 'sales_return'));
        }
        if (type === 'all' || type === 'purchase_return') {
            queries.push(buildQuery('purchase_returns', 'purchase_return'));
        }

        // Treasury transactions (receipt/payment)
        const buildTreasuryQuery = (treasuryType, typeLabel) => {
            let sql = `
                SELECT 
                    '${typeLabel}' as type,
                    t.id,
                    t.voucher_number as invoice_number,
                    t.transaction_date as invoice_date,
                    t.amount as total_amount,
                    c.name as customer_name
                FROM treasury_transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                WHERE t.type = '${treasuryType}' AND t.customer_id IS NOT NULL
            `;
            if (startDate) {
                sql += ` AND t.transaction_date >= @startDate`;
            }
            if (endDate) {
                sql += ` AND t.transaction_date <= @endDate`;
            }
            if (customerId) {
                sql += ` AND t.customer_id = @customerId`;
            }
            return sql;
        };

        if (type === 'all' || type === 'receipt') {
            queries.push(buildTreasuryQuery('income', 'receipt'));
        }
        if (type === 'all' || type === 'payment') {
            queries.push(buildTreasuryQuery('expense', 'payment'));
        }

        if (queries.length === 0) return [];

        const finalQuery = queries.join(' UNION ALL ') + ' ORDER BY invoice_date DESC';
        
        return db.prepare(finalQuery).all({ startDate, endDate, customerId });
    });

    ipcMain.handle('get-customer-full-report', (event, customerId) => {
        const salesQuery = `
            SELECT 
                'sales' as type,
                si.id,
                si.invoice_number,
                si.invoice_date,
                si.total_amount,
                si.notes
            FROM sales_invoices si
            WHERE si.customer_id = ?
        `;
        
        const purchaseQuery = `
            SELECT 
                'purchase' as type,
                pi.id,
                pi.invoice_number,
                pi.invoice_date,
                pi.total_amount,
                pi.notes
            FROM purchase_invoices pi
            WHERE pi.supplier_id = ?
        `;

        const paymentsQuery = `
            SELECT 
                CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as type,
                id,
                'سند' as invoice_number,
                transaction_date as invoice_date,
                amount as total_amount,
                description as notes
            FROM treasury_transactions
            WHERE customer_id = ?
               OR (related_type = 'sales' AND related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?))
               OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?))
        `;

        const sales = db.prepare(salesQuery).all(customerId);
        const purchases = db.prepare(purchaseQuery).all(customerId);
        const payments = db.prepare(paymentsQuery).all(customerId, customerId, customerId);
        
        // Combine and sort
        return [...sales, ...purchases, ...payments].sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
    });

    // كشف حساب تفصيلي للعميل (محدث - يشمل المردودات)
    ipcMain.handle('get-customer-detailed-statement', (event, { customerId, startDate, endDate }) => {
        try {
            const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
            if (!customer) {
                return { success: false, error: 'العميل غير موجود' };
            }

            const custId = Number(customerId);
            let openingBalance = customer.opening_balance || 0;

            // حساب الرصيد الافتتاحي من جميع الحركات قبل تاريخ البداية باستخدام UNION ALL
            if (startDate) {
                const obResult = db.prepare(`
                    SELECT COALESCE(SUM(
                        CASE
                            WHEN sub_type = 'sales' THEN amount
                            WHEN sub_type = 'purchase' THEN -amount
                            WHEN sub_type = 'payment_in' THEN -amount
                            WHEN sub_type = 'payment_out' THEN amount
                            WHEN sub_type = 'sales_return' THEN -amount
                            WHEN sub_type = 'purchase_return' THEN amount
                            ELSE 0
                        END
                    ), 0) as net
                    FROM (
                        SELECT 'sales' as sub_type, total_amount as amount
                        FROM sales_invoices WHERE customer_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT 'purchase' as sub_type, total_amount as amount
                        FROM purchase_invoices WHERE supplier_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as sub_type,
                               amount
                        FROM treasury_transactions
                        WHERE (customer_id = ?
                           OR (related_type = 'sales' AND related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?))
                           OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                        AND COALESCE(related_type, '') NOT IN ('sales_return', 'purchase_return')
                        AND transaction_date < ?

                        UNION ALL
                        SELECT 'sales_return' as sub_type, total_amount as amount
                        FROM sales_returns WHERE customer_id = ? AND return_date < ?

                        UNION ALL
                        SELECT 'purchase_return' as sub_type, total_amount as amount
                        FROM purchase_returns WHERE supplier_id = ? AND return_date < ?
                    ) sub
                `).get(
                    custId, startDate,
                    custId, startDate,
                    custId, custId, custId, startDate,
                    custId, startDate,
                    custId, startDate
                );
                openingBalance += obResult.net;
            }

            // جلب جميع الحركات داخل الفترة باستخدام UNION ALL
            const params = [];
            let query = `
                SELECT id, 'sales' as type, invoice_number as doc_number, invoice_date as trans_date, total_amount, notes
                FROM sales_invoices WHERE customer_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'purchase' as type, invoice_number as doc_number, invoice_date as trans_date, total_amount, notes
                FROM purchase_invoices WHERE supplier_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as type,
                    voucher_number as doc_number, transaction_date as trans_date, amount as total_amount, description as notes
                FROM treasury_transactions
                WHERE (customer_id = ?
                   OR (related_type = 'sales' AND related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?))
                   OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                AND COALESCE(related_type, '') NOT IN ('sales_return', 'purchase_return')`;
            params.push(custId, custId, custId);
            if (startDate) { query += ' AND transaction_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND transaction_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'sales_return' as type, return_number as doc_number, return_date as trans_date, total_amount, notes
                FROM sales_returns WHERE customer_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND return_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND return_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'purchase_return' as type, return_number as doc_number, return_date as trans_date, total_amount, notes
                FROM purchase_returns WHERE supplier_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND return_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND return_date <= ?'; params.push(endDate); }

            query += ' ORDER BY trans_date ASC, id ASC';

            const transactions = db.prepare(query).all(...params);

            // حساب المدين والدائن والرصيد الجاري
            // مدين: مبيعات، سداد، مردود مشتريات
            // دائن: مشتريات، تحصيل، مردود مبيعات
            let runningBalance = openingBalance;
            for (const trans of transactions) {
                if (trans.type === 'sales' || trans.type === 'payment_out' || trans.type === 'purchase_return') {
                    trans.debit = trans.total_amount;
                    trans.credit = 0;
                    runningBalance += trans.total_amount;
                } else {
                    trans.debit = 0;
                    trans.credit = trans.total_amount;
                    runningBalance -= trans.total_amount;
                }
                trans.running_balance = runningBalance;
            }

            // حساب الإجماليات
            const totals = {
                totalSales: transactions.filter(t => t.type === 'sales').reduce((s, t) => s + t.total_amount, 0),
                totalPurchases: transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.total_amount, 0),
                totalPaymentsIn: transactions.filter(t => t.type === 'payment_in').reduce((s, t) => s + t.total_amount, 0),
                totalPaymentsOut: transactions.filter(t => t.type === 'payment_out').reduce((s, t) => s + t.total_amount, 0),
                totalSalesReturns: transactions.filter(t => t.type === 'sales_return').reduce((s, t) => s + t.total_amount, 0),
                totalPurchaseReturns: transactions.filter(t => t.type === 'purchase_return').reduce((s, t) => s + t.total_amount, 0),
                openingBalance: openingBalance,
                closingBalance: runningBalance
            };

            return {
                success: true,
                customer: customer,
                transactions: transactions,
                totals: totals,
                period: { startDate, endDate }
            };
        } catch (error) {
            console.error('Error getting customer detailed statement:', error);
            return { success: false, error: error.message };
        }
    });

    // تحميل تفاصيل الأصناف عند الطلب (Lazy Loading)
    ipcMain.handle('get-statement-item-details', (event, { type, id }) => {
        try {
            let details = [];
            if (type === 'sales') {
                details = db.prepare(`
                    SELECT sid.quantity, sid.sale_price as price, sid.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM sales_invoice_details sid
                    JOIN items i ON sid.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE sid.invoice_id = ?
                `).all(id);
            } else if (type === 'purchase') {
                details = db.prepare(`
                    SELECT pid.quantity, pid.cost_price as price, pid.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM purchase_invoice_details pid
                    JOIN items i ON pid.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE pid.invoice_id = ?
                `).all(id);
            } else if (type === 'sales_return') {
                details = db.prepare(`
                    SELECT srd.quantity, srd.price, srd.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM sales_return_details srd
                    JOIN items i ON srd.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE srd.return_id = ?
                `).all(id);
            } else if (type === 'purchase_return') {
                details = db.prepare(`
                    SELECT prd.quantity, prd.price, prd.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM purchase_return_details prd
                    JOIN items i ON prd.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE prd.return_id = ?
                `).all(id);
            }
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- PDF Export Handlers ---

    ipcMain.handle('save-debtor-creditor-pdf', async (event, payload) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().split('T')[0];
            const requestedDefault = payload?.defaultName;
            const defaultName = sanitizeSuggestedFileName(requestedDefault || `Debtor_Creditor_Report_${date}.pdf`);
            const defaultPath = path.join(app.getPath('documents'), defaultName);

            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ تقرير PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfBuffer = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                marginsType: 1,
                preferCSSPageSize: true
            });

            // Set PDF metadata title to match the chosen filename (without extension)
            const title = path.basename(filePath, path.extname(filePath));
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            pdfDoc.setTitle(title);
            pdfDoc.setCreator('Accounting System');
            pdfDoc.setProducer('Accounting System');

            const finalPdf = await pdfDoc.save();
            fs.writeFileSync(filePath, finalPdf);

            return { success: true, filePath };
        } catch (error) {
            console.error('[save-debtor-creditor-pdf] error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('save-customer-report-pdf', async (event, payload) => {
        try {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().split('T')[0];
            const requestedDefault = payload?.defaultName;
            const defaultName = sanitizeSuggestedFileName(requestedDefault || `Customer_Report_${date}.pdf`);
            const defaultPath = path.join(app.getPath('documents'), defaultName);

            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ تقرير العميل PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfBuffer = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4',
                landscape: true,
                marginsType: 0,
                preferCSSPageSize: true
            });

            // Set PDF metadata title to match the chosen filename (without extension)
            const title = path.basename(filePath, path.extname(filePath));
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            pdfDoc.setTitle(title);
            pdfDoc.setCreator('Accounting System');
            pdfDoc.setProducer('Accounting System');

            // Add page numbers
            const pages = pdfDoc.getPages();
            const totalPages = pages.length;
            if (totalPages > 0) {
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                pages.forEach((page, i) => {
                    const { width } = page.getSize();
                    const text = `${i + 1} / ${totalPages}`;
                    const textWidth = font.widthOfTextAtSize(text, 9);
                    page.drawText(text, {
                        x: (width - textWidth) / 2,
                        y: 6,
                        size: 9,
                        font,
                        color: rgb(0.45, 0.45, 0.45)
                    });
                });
            }

            const finalPdf = await pdfDoc.save();
            fs.writeFileSync(filePath, finalPdf);

            return { success: true, filePath };
        } catch (error) {
            console.error('[save-customer-report-pdf] error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
