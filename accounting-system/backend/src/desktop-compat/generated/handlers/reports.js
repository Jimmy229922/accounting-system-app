const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { db } = require('../db');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { sanitizeSuggestedFileName } = require('./utils');

function getCustomerStatementTransactionEffect(trans) {
    const amount = Number(trans && trans.total_amount) || 0;
    if (trans.type === 'sales' || trans.type === 'payment_out' || trans.type === 'purchase_return') {
        return amount;
    }
    return -amount;
}

function getCustomerStatementMovementAfterDate(customerId, afterDate) {
    if (!afterDate) return 0;

    const custId = Number(customerId);
    const row = db.prepare(`
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
            SELECT 'sales' as sub_type, total_amount as amount, invoice_date as trans_date
            FROM sales_invoices WHERE customer_id = @custId

            UNION ALL
            SELECT 'payment_in' as sub_type, paid_amount as amount, invoice_date as trans_date
            FROM sales_invoices WHERE customer_id = @custId AND paid_amount > 0

            UNION ALL
            SELECT 'purchase' as sub_type, total_amount as amount, invoice_date as trans_date
            FROM purchase_invoices WHERE supplier_id = @custId

            UNION ALL
            SELECT CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as sub_type,
                   amount, transaction_date as trans_date
            FROM treasury_transactions
            WHERE (customer_id = @custId
               OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = @custId)))
            AND COALESCE(related_type, '') NOT IN ('sales')

            UNION ALL
            SELECT 'sales_return' as sub_type, total_amount as amount, return_date as trans_date
            FROM sales_returns WHERE customer_id = @custId

            UNION ALL
            SELECT 'purchase_return' as sub_type, total_amount as amount, return_date as trans_date
            FROM purchase_returns WHERE supplier_id = @custId
        ) sub
        WHERE trans_date > @afterDate
    `).get({ custId, afterDate });

    return Number(row && row.net) || 0;
}

async function prepareShellFrameForPdfCapture(webContents) {
    if (!webContents || webContents.isDestroyed()) {
        return;
    }

    try {
        await webContents.executeJavaScript(`
            (() => {
                const shellRoot = document.querySelector('.shell-root');
                const frame = document.getElementById('shellFrame');
                if (!shellRoot || !frame) return;

                if (window.__pdfShellCaptureState) {
                    window.__pdfShellCaptureState.captureDepth = (window.__pdfShellCaptureState.captureDepth || 1) + 1;
                    return;
                }

                const shellNav = document.querySelector('.shell-top-nav');
                const shellStage = document.querySelector('.shell-stage');
                const htmlEl = document.documentElement;
                const bodyEl = document.body;

                const state = {
                    htmlOverflow: htmlEl ? (htmlEl.style.overflow || '') : '',
                    bodyOverflow: bodyEl ? (bodyEl.style.overflow || '') : '',
                    rootHeight: shellRoot.style.height || '',
                    rootMinHeight: shellRoot.style.minHeight || '',
                    rootOverflow: shellRoot.style.overflow || '',
                    navDisplay: shellNav ? (shellNav.style.display || '') : '',
                    stagePadding: shellStage ? (shellStage.style.padding || '') : '',
                    stageOverflow: shellStage ? (shellStage.style.overflow || '') : '',
                    stageBackground: shellStage ? (shellStage.style.background || '') : '',
                    frameHeight: frame.style.height || '',
                    frameHeightPriority: frame.style.getPropertyPriority('height') || '',
                    frameOverflow: frame.style.overflow || '',
                    frameBorderRadius: frame.style.borderRadius || '',
                    frameBoxShadow: frame.style.boxShadow || '',
                    frameDocHtmlOverflow: '',
                    frameDocBodyOverflow: '',
                    captureDepth: 1,
                    parentInjectedStyleId: 'pdf-shell-parent-capture-style',
                    injectedStyleId: 'pdf-shell-capture-style'
                };

                if (htmlEl) htmlEl.style.overflow = 'visible';
                if (bodyEl) bodyEl.style.overflow = 'visible';
                shellRoot.style.height = 'auto';
                shellRoot.style.minHeight = '0';
                shellRoot.style.overflow = 'visible';

                if (shellNav) shellNav.style.display = 'none';
                if (shellStage) {
                    shellStage.style.padding = '0';
                    shellStage.style.overflow = 'visible';
                    shellStage.style.background = '#fff';
                }

                if (!document.getElementById(state.parentInjectedStyleId)) {
                    const style = document.createElement('style');
                    style.id = state.parentInjectedStyleId;
                    style.textContent = '.toast-container { display: none !important; }';
                    document.head.appendChild(style);
                }

                frame.style.overflow = 'visible';
                frame.style.borderRadius = '0';
                frame.style.boxShadow = 'none';

                try {
                    const frameDoc = frame.contentDocument;
                    const frameWin = frame.contentWindow;
                    if (frameDoc && frameWin) {
                        const frameHtml = frameDoc.documentElement;
                        const frameBody = frameDoc.body;

                        state.frameDocHtmlOverflow = frameHtml ? (frameHtml.style.overflow || '') : '';
                        state.frameDocBodyOverflow = frameBody ? (frameBody.style.overflow || '') : '';

                        if (frameHtml) frameHtml.style.overflow = 'visible';
                        if (frameBody) frameBody.style.overflow = 'visible';

                        if (!frameDoc.getElementById(state.injectedStyleId)) {
                            const style = frameDoc.createElement('style');
                            style.id = state.injectedStyleId;
                            style.textContent = '.top-nav, .shell-top-nav, .toast-container { display: none !important; } html, body, #app, .content, .report-container { overflow: visible !important; max-height: none !important; height: auto !important; }';
                            frameDoc.head.appendChild(style);
                        }

                        const printableRoot = frameDoc.getElementById('summaryPrintView')
                            || frameDoc.querySelector('.report-container')
                            || frameBody;
                        const printableHeight = Math.max(
                            printableRoot ? Math.ceil(printableRoot.getBoundingClientRect().height) : 0,
                            printableRoot ? printableRoot.scrollHeight : 0,
                            1
                        );
                        frame.style.setProperty('height', String(printableHeight) + 'px', 'important');
                    }
                } catch (_) {}

                window.__pdfShellCaptureState = state;
            })();
        `, true);
    } catch (_) {
        // Ignore capture prep errors and continue with normal print flow.
    }
}

async function restoreShellFrameAfterPdfCapture(webContents) {
    if (!webContents || webContents.isDestroyed()) {
        return;
    }

    try {
        await webContents.executeJavaScript(`
            (() => {
                const state = window.__pdfShellCaptureState;
                if (!state) return;

                if ((state.captureDepth || 1) > 1) {
                    state.captureDepth -= 1;
                    return;
                }

                const shellRoot = document.querySelector('.shell-root');
                const frame = document.getElementById('shellFrame');
                const shellNav = document.querySelector('.shell-top-nav');
                const shellStage = document.querySelector('.shell-stage');
                const htmlEl = document.documentElement;
                const bodyEl = document.body;

                if (htmlEl) htmlEl.style.overflow = state.htmlOverflow || '';
                if (bodyEl) bodyEl.style.overflow = state.bodyOverflow || '';

                if (shellRoot) {
                    shellRoot.style.height = state.rootHeight || '';
                    shellRoot.style.minHeight = state.rootMinHeight || '';
                    shellRoot.style.overflow = state.rootOverflow || '';
                }

                if (shellNav) shellNav.style.display = state.navDisplay || '';
                if (shellStage) {
                    shellStage.style.padding = state.stagePadding || '';
                    shellStage.style.overflow = state.stageOverflow || '';
                    shellStage.style.background = state.stageBackground || '';
                }

                const parentInjectedStyle = document.getElementById(state.parentInjectedStyleId || 'pdf-shell-parent-capture-style');
                if (parentInjectedStyle && parentInjectedStyle.parentNode) {
                    parentInjectedStyle.parentNode.removeChild(parentInjectedStyle);
                }

                if (frame) {
                    if (state.frameHeight) {
                        frame.style.setProperty('height', state.frameHeight, state.frameHeightPriority || '');
                    } else {
                        frame.style.removeProperty('height');
                    }
                    frame.style.overflow = state.frameOverflow || '';
                    frame.style.borderRadius = state.frameBorderRadius || '';
                    frame.style.boxShadow = state.frameBoxShadow || '';

                    try {
                        const frameDoc = frame.contentDocument;
                        if (frameDoc) {
                            const frameHtml = frameDoc.documentElement;
                            const frameBody = frameDoc.body;
                            if (frameHtml) frameHtml.style.overflow = state.frameDocHtmlOverflow || '';
                            if (frameBody) frameBody.style.overflow = state.frameDocBodyOverflow || '';

                            const injectedStyle = frameDoc.getElementById(state.injectedStyleId || 'pdf-shell-capture-style');
                            if (injectedStyle && injectedStyle.parentNode) {
                                injectedStyle.parentNode.removeChild(injectedStyle);
                            }
                        }
                    } catch (_) {}
                }

                delete window.__pdfShellCaptureState;
            })();
        `, true);
    } catch (_) {
        // Ignore restore errors.
    }
}

async function printStandaloneCustomerReport(htmlContent, printOptions) {
    if (typeof htmlContent !== 'string' || !htmlContent.trim()) {
        throw new Error('Missing customer report HTML');
    }

    const tempFilePath = path.join(
        app.getPath('temp'),
        `accounting-customer-report-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
    );
    let printWindow = null;
    const withTimeout = (promise, timeoutMs, message) => new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
        Promise.resolve(promise).then(
            (value) => {
                clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
    const deleteTemporaryFile = async () => {
        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
                return;
            } catch (error) {
                if (attempt === 5) {
                    console.error('Failed to delete temporary customer report HTML:', error);
                    return;
                }
                await new Promise((resolve) => setTimeout(resolve, attempt * 200));
            }
        }
    };

    try {
        fs.writeFileSync(tempFilePath, htmlContent, 'utf8');
        printWindow = new BrowserWindow({
            show: false,
            skipTaskbar: true,
            backgroundColor: '#ffffff',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                javascript: false,
                sandbox: true
            }
        });

        const loadingStopped = new Promise((resolve) => {
            printWindow.webContents.once('did-stop-loading', resolve);
        });
        await withTimeout(printWindow.loadFile(tempFilePath), 15000, 'Timed out loading customer report HTML');
        await withTimeout(loadingStopped, 5000, 'Timed out loading customer report resources');
        await new Promise((resolve) => setTimeout(resolve, 250));

        return await withTimeout(
            printWindow.webContents.printToPDF(printOptions),
            30000,
            'Timed out generating customer report PDF'
        );
    } finally {
        if (printWindow && !printWindow.isDestroyed()) {
            printWindow.destroy();
        }
        await deleteTemporaryFile();
    }
}

function register() {
    // --- Reports Handlers ---

    ipcMain.handle('get-all-reports', (event, filters) => {
        try {
        const { startDate, endDate, customerId, type } = filters;
        
        // Helper to build query parts
        const buildQuery = (table, typeLabel) => {
            const isReturn = typeLabel === 'sales_return' || typeLabel === 'purchase_return';
            const dateCol = isReturn ? 'return_date' : 'invoice_date';
            const numCol = isReturn ? 'return_number' : 'invoice_number';
            const joinCol = (typeLabel === 'sales' || typeLabel === 'sales_return') ? 'customer_id' : 'supplier_id';
            const paidAmountExpr = isReturn ? '0' : 'COALESCE(i.paid_amount, 0)';
            const remainingAmountExpr = isReturn ? '0' : '(COALESCE(i.total_amount, 0) - COALESCE(i.paid_amount, 0))';
            let sql = `
                SELECT 
                    '${typeLabel}' as type,
                    i.id,
                    i.${numCol} as invoice_number,
                    i.${dateCol} as invoice_date,
                    i.total_amount,
                    ${paidAmountExpr} as paid_amount,
                    ${remainingAmountExpr} as remaining_amount,
                    c.name as customer_name,
                    i.created_at
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
                    0 as paid_amount,
                    0 as remaining_amount,
                    c.name as customer_name,
                    t.created_at
                FROM treasury_transactions t
                LEFT JOIN customers c ON t.customer_id = c.id
                WHERE t.type = '${treasuryType}' AND t.customer_id IS NOT NULL
                  AND COALESCE(t.related_type, '') IN ('', 'customer_collection_pending', 'customer_collection_shift_close')
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

        const finalQuery = queries.join(' UNION ALL ') + ' ORDER BY invoice_date ASC, created_at ASC';
        
        return db.prepare(finalQuery).all({ startDate, endDate, customerId });
        } catch (error) {
            console.error('[get-all-reports] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-customer-full-report', (event, customerId) => {
        try {
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
                COALESCE(voucher_number, '-') as invoice_number,
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
        } catch (error) {
            console.error('[get-customer-full-report] Error:', error);
            return [];
        }
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
                        SELECT 'sales' as sub_type, (COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) as amount
                        FROM sales_invoices WHERE customer_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT 'purchase' as sub_type, (COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) as amount
                        FROM purchase_invoices WHERE supplier_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as sub_type,
                               amount
                        FROM treasury_transactions
                        WHERE (customer_id = ?
                           OR (related_type = 'sales' AND related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?))
                           OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                        AND COALESCE(related_type, '') IN ('', 'customer_collection_pending', 'customer_collection_shift_close')
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
                SELECT id, 'sales' as type, invoice_number as doc_number, invoice_date as trans_date, total_amount, COALESCE(paid_amount, 0) as paid_amount, (COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) as remaining_amount, notes, created_at, 1 as internal_order
                FROM sales_invoices WHERE customer_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'purchase' as type, invoice_number as doc_number, invoice_date as trans_date, total_amount, COALESCE(paid_amount, 0) as paid_amount, (COALESCE(total_amount, 0) - COALESCE(paid_amount, 0)) as remaining_amount, notes, created_at, 1 as internal_order
                FROM purchase_invoices WHERE supplier_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as type,
                    voucher_number as doc_number, transaction_date as trans_date, amount as total_amount, 0 as paid_amount, 0 as remaining_amount, description as notes, created_at, 1 as internal_order
                FROM treasury_transactions
                WHERE (customer_id = ?
                   OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                AND COALESCE(related_type, '') IN ('', 'customer_collection_pending', 'customer_collection_shift_close')`;
            params.push(custId, custId);
            if (startDate) { query += ' AND transaction_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND transaction_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'sales_return' as type, return_number as doc_number, return_date as trans_date, total_amount, 0 as paid_amount, 0 as remaining_amount, notes, created_at, 1 as internal_order
                FROM sales_returns WHERE customer_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND return_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND return_date <= ?'; params.push(endDate); }

            query += `
                UNION ALL
                SELECT id, 'purchase_return' as type, return_number as doc_number, return_date as trans_date, total_amount, 0 as paid_amount, 0 as remaining_amount, notes, created_at, 1 as internal_order
                FROM purchase_returns WHERE supplier_id = ?`;
            params.push(custId);
            if (startDate) { query += ' AND return_date >= ?'; params.push(startDate); }
            if (endDate) { query += ' AND return_date <= ?'; params.push(endDate); }

            query += ' ORDER BY trans_date ASC, created_at ASC, internal_order ASC, id ASC';

            const transactions = db.prepare(query).all(...params);
            // حساب المدين والدائن والرصيد الجاري
            // مدين: مبيعات، سداد، مردود مشتريات
            // دائن: مشتريات، تحصيل، مردود مبيعات
            let runningBalance = openingBalance;
            for (const trans of transactions) {
                const balanceAmount = (trans.type === 'sales' || trans.type === 'purchase')
                    ? Number(trans.remaining_amount || 0)
                    : Number(trans.total_amount || 0);
                if (trans.type === 'sales' || trans.type === 'payment_out' || trans.type === 'purchase_return') {
                    trans.debit = trans.total_amount;
                    trans.credit = 0;
                    runningBalance += balanceAmount;
                } else {
                    trans.debit = 0;
                    trans.credit = trans.total_amount;
                    runningBalance -= balanceAmount;
                }
                trans.running_balance = runningBalance;
            }

            // حساب الإجماليات
            const totals = {
                totalSales: transactions.filter(t => t.type === 'sales').reduce((s, t) => s + t.total_amount, 0),
                totalPurchases: transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.total_amount, 0),
                totalPaymentsIn: transactions.filter(t => t.type === 'payment_in').reduce((s, t) => s + t.total_amount, 0) + transactions.filter(t => t.type === 'sales').reduce((s, t) => s + Number(t.paid_amount || 0), 0),
                totalPaymentsOut: transactions.filter(t => t.type === 'payment_out').reduce((s, t) => s + t.total_amount, 0) + transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.paid_amount || 0), 0),
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
                    ORDER BY sid.id ASC
                `).all(id);
            } else if (type === 'purchase') {
                details = db.prepare(`
                    SELECT pid.quantity, pid.cost_price as price, pid.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM purchase_invoice_details pid
                    JOIN items i ON pid.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE pid.invoice_id = ?
                    ORDER BY pid.id ASC
                `).all(id);
            } else if (type === 'sales_return') {
                details = db.prepare(`
                    SELECT srd.quantity, srd.price, srd.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM sales_return_details srd
                    JOIN items i ON srd.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE srd.return_id = ?
                    ORDER BY srd.id ASC
                `).all(id);
            } else if (type === 'purchase_return') {
                details = db.prepare(`
                    SELECT prd.quantity, prd.price, prd.total_price,
                           i.name as item_name, u.name as unit_name
                    FROM purchase_return_details prd
                    JOIN items i ON prd.item_id = i.id
                    LEFT JOIN units u ON i.unit_id = u.id
                    WHERE prd.return_id = ?
                    ORDER BY prd.id ASC
                `).all(id);
            }
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // كشف حساب مجمع للعميل - يجمع كل الأصناف من كل الفواتير في جدول واحد
    ipcMain.handle('get-customer-summary-statement', (event, { customerId, startDate, endDate }) => {
        try {
            const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
            if (!customer) {
                return { success: false, error: 'العميل غير موجود' };
            }

            const custId = Number(customerId);

            // --- جلب أصناف المبيعات ---
            let salesItemsQuery = `
                SELECT i.name as item_name, u.name as unit_name,
                       SUM(sid.quantity) as total_qty,
                       ROUND(SUM(sid.total_price) * 1.0 / SUM(sid.quantity), 2) as avg_price,
                       SUM(sid.total_price) as total_amount
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                JOIN items i ON sid.item_id = i.id
                LEFT JOIN units u ON i.unit_id = u.id
                 WHERE si.customer_id = ?`;
            const salesParams = [custId];
            if (startDate) { salesItemsQuery += ' AND si.invoice_date >= ?'; salesParams.push(startDate); }
            if (endDate) { salesItemsQuery += ' AND si.invoice_date <= ?'; salesParams.push(endDate); }
            salesItemsQuery += ' GROUP BY i.id ORDER BY i.name ASC';

            // --- جلب أصناف المشتريات ---
            let purchaseItemsQuery = `
                SELECT i.name as item_name, u.name as unit_name,
                       SUM(pid.quantity) as total_qty,
                       ROUND(SUM(pid.total_price) * 1.0 / SUM(pid.quantity), 2) as avg_price,
                       SUM(pid.total_price) as total_amount
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
                JOIN items i ON pid.item_id = i.id
                LEFT JOIN units u ON i.unit_id = u.id
                 WHERE pi.supplier_id = ?`;
            const purchaseParams = [custId];
            if (startDate) { purchaseItemsQuery += ' AND pi.invoice_date >= ?'; purchaseParams.push(startDate); }
            if (endDate) { purchaseItemsQuery += ' AND pi.invoice_date <= ?'; purchaseParams.push(endDate); }
            purchaseItemsQuery += ' GROUP BY i.id ORDER BY i.name ASC';

            // --- جلب أصناف مردودات المبيعات ---
            let salesReturnItemsQuery = `
                SELECT i.name as item_name, u.name as unit_name,
                       SUM(srd.quantity) as total_qty,
                       ROUND(SUM(srd.total_price) * 1.0 / SUM(srd.quantity), 2) as avg_price,
                       SUM(srd.total_price) as total_amount
                FROM sales_return_details srd
                JOIN sales_returns sr ON srd.return_id = sr.id
                JOIN items i ON srd.item_id = i.id
                LEFT JOIN units u ON i.unit_id = u.id
                WHERE sr.customer_id = ?`;
            const salesReturnParams = [custId];
            if (startDate) { salesReturnItemsQuery += ' AND sr.return_date >= ?'; salesReturnParams.push(startDate); }
            if (endDate) { salesReturnItemsQuery += ' AND sr.return_date <= ?'; salesReturnParams.push(endDate); }
            salesReturnItemsQuery += ' GROUP BY i.id ORDER BY i.name ASC';

            // --- جلب أصناف مردودات المشتريات ---
            let purchaseReturnItemsQuery = `
                SELECT i.name as item_name, u.name as unit_name,
                       SUM(prd.quantity) as total_qty,
                       ROUND(SUM(prd.total_price) * 1.0 / SUM(prd.quantity), 2) as avg_price,
                       SUM(prd.total_price) as total_amount
                FROM purchase_return_details prd
                JOIN purchase_returns pr ON prd.return_id = pr.id
                JOIN items i ON prd.item_id = i.id
                LEFT JOIN units u ON i.unit_id = u.id
                WHERE pr.supplier_id = ?`;
            const purchaseReturnParams = [custId];
            if (startDate) { purchaseReturnItemsQuery += ' AND pr.return_date >= ?'; purchaseReturnParams.push(startDate); }
            if (endDate) { purchaseReturnItemsQuery += ' AND pr.return_date <= ?'; purchaseReturnParams.push(endDate); }
            purchaseReturnItemsQuery += ' GROUP BY i.id ORDER BY i.name ASC';

            const salesItems = db.prepare(salesItemsQuery).all(...salesParams);
            const purchaseItems = db.prepare(purchaseItemsQuery).all(...purchaseParams);
            const salesReturnItems = db.prepare(salesReturnItemsQuery).all(...salesReturnParams);
            const purchaseReturnItems = db.prepare(purchaseReturnItemsQuery).all(...purchaseReturnParams);

            // --- إجماليات التحصيلات والسداد ---
            let paymentsQuery = `
                SELECT type, SUM(amount) as total_amount
                FROM treasury_transactions
                WHERE (customer_id = ?
                    OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                AND COALESCE(related_type, '') NOT IN ('sales')`;
            const paymentParams = [custId, custId];
            if (startDate) { paymentsQuery += ' AND transaction_date >= ?'; paymentParams.push(startDate); }
            if (endDate) { paymentsQuery += ' AND transaction_date <= ?'; paymentParams.push(endDate); }
            paymentsQuery += ' GROUP BY type';

            const paymentRows = db.prepare(paymentsQuery).all(...paymentParams);
            let totalPaymentsIn = 0;
            let totalPaymentsOut = 0;
            for (const row of paymentRows) {
                if (row.type === 'income') totalPaymentsIn = row.total_amount;
                else totalPaymentsOut = row.total_amount;
            }
            let invoicePaymentsQuery = `
                SELECT COALESCE(SUM(paid_amount), 0) as total_amount
                FROM sales_invoices
                WHERE customer_id = ? AND paid_amount > 0`;
            const invoicePaymentParams = [custId];
            if (startDate) { invoicePaymentsQuery += ' AND invoice_date >= ?'; invoicePaymentParams.push(startDate); }
            if (endDate) { invoicePaymentsQuery += ' AND invoice_date <= ?'; invoicePaymentParams.push(endDate); }
            const invoicePaymentRow = db.prepare(invoicePaymentsQuery).get(...invoicePaymentParams);
            totalPaymentsIn += invoicePaymentRow.total_amount || 0;

            // --- حساب الرصيد الافتتاحي ---
            let openingBalance = customer.opening_balance || 0;
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
                        SELECT 'sales' as sub_type, total_amount as amount FROM sales_invoices WHERE customer_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT 'payment_in' as sub_type, paid_amount as amount FROM sales_invoices WHERE customer_id = ? AND invoice_date < ? AND paid_amount > 0

                        UNION ALL
                        SELECT 'purchase' as sub_type, total_amount as amount FROM purchase_invoices WHERE supplier_id = ? AND invoice_date < ?

                        UNION ALL
                        SELECT CASE WHEN type = 'income' THEN 'payment_in' ELSE 'payment_out' END as sub_type,
                               amount
                        FROM treasury_transactions
                        WHERE (customer_id = ?
                           OR (related_type = 'sales' AND related_invoice_id IN (SELECT id FROM sales_invoices WHERE customer_id = ?))
                           OR (related_type = 'purchase' AND related_invoice_id IN (SELECT id FROM purchase_invoices WHERE supplier_id = ?)))
                        AND COALESCE(related_type, '') NOT IN ('sales')
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
                    custId, startDate,
                    custId, custId, custId, startDate,
                    custId, startDate,
                    custId, startDate
                );
                openingBalance += obResult.net;
            }

            const totalSales = salesItems.reduce((s, i) => s + i.total_amount, 0);
            const totalPurchases = purchaseItems.reduce((s, i) => s + i.total_amount, 0);
            const totalSalesReturns = salesReturnItems.reduce((s, i) => s + i.total_amount, 0);
            const totalPurchaseReturns = purchaseReturnItems.reduce((s, i) => s + i.total_amount, 0);

            const totalDebit = totalSales + totalPaymentsOut + totalPurchaseReturns;
            const totalCredit = totalPurchases + totalPaymentsIn + totalSalesReturns;
            const closingBalance = openingBalance + (totalDebit - totalCredit);

            return {
                success: true,
                customer,
                salesItems,
                purchaseItems,
                salesReturnItems,
                purchaseReturnItems,
                totals: {
                    totalSales,
                    totalPurchases,
                    totalPaymentsIn,
                    totalPaymentsOut,
                    totalSalesReturns,
                    totalPurchaseReturns,
                    openingBalance,
                    closingBalance
                },
                period: { startDate, endDate }
            };
        } catch (error) {
            console.error('Error getting customer summary statement:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-invoice-profit-report', (event, filters) => {
        try {
            const { startDate, endDate, customerName } = filters;
            let sql = `
                SELECT 
                    'sales' as record_type,
                    si.id, 
                    si.invoice_number, 
                    si.invoice_date, 
                    c.name as customer_name,
                    si.total_amount,
                    COALESCE(SUM(sid.quantity * sid.cost_price), 0) as total_cost,
                    (si.total_amount - COALESCE(SUM(sid.quantity * sid.cost_price), 0)) as profit_amount
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                LEFT JOIN sales_invoice_details sid ON si.id = sid.invoice_id
                WHERE 1=1
            `;
            let params = [];
            if (startDate) {
                sql += ` AND si.invoice_date >= ?`;
                params.push(startDate);
            }
            if (endDate) {
                sql += ` AND si.invoice_date <= ?`;
                params.push(endDate);
            }
            if (customerName) {
                sql += ` AND c.name LIKE ?`;
                params.push(`%${customerName}%`);
            }
            sql += ` GROUP BY si.id ORDER BY si.invoice_date DESC, si.id DESC`;
            
            const results = db.prepare(sql).all(...params);

            let returnsSql = `
                SELECT
                    'sales_return' as record_type,
                    sr.id,
                    sr.return_number as invoice_number,
                    sr.return_date as invoice_date,
                    c.name as customer_name,
                    -sr.total_amount as total_amount,
                    -COALESCE(SUM(srd.quantity * srd.cost_price), 0) as total_cost,
                    (COALESCE(SUM(srd.quantity * srd.cost_price), 0) - sr.total_amount) as profit_amount
                FROM sales_returns sr
                LEFT JOIN customers c ON sr.customer_id = c.id
                LEFT JOIN sales_return_details srd ON sr.id = srd.return_id
                WHERE 1=1
            `;
            const returnsParams = [];
            if (startDate) {
                returnsSql += ` AND sr.return_date >= ?`;
                returnsParams.push(startDate);
            }
            if (endDate) {
                returnsSql += ` AND sr.return_date <= ?`;
                returnsParams.push(endDate);
            }
            if (customerName) {
                returnsSql += ` AND c.name LIKE ?`;
                returnsParams.push(`%${customerName}%`);
            }
            returnsSql += ` GROUP BY sr.id`;
            const returnRows = db.prepare(returnsSql).all(...returnsParams);
            results.push(...returnRows);
            results.sort((a, b) => {
                const dateCompare = String(b.invoice_date || '').localeCompare(String(a.invoice_date || ''));
                if (dateCompare !== 0) return dateCompare;
                return Number(b.id || 0) - Number(a.id || 0);
            });

            let salesTotalSql = `
                SELECT COALESCE(SUM(si.total_amount), 0) as total
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE 1=1
            `;
            let salesCostSql = `
                SELECT COALESCE(SUM(sid.quantity * sid.cost_price), 0) as total
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE 1=1
            `;
            let returnsTotalSql = `
                SELECT COALESCE(SUM(sr.total_amount), 0) as total
                FROM sales_returns sr
                LEFT JOIN customers c ON sr.customer_id = c.id
                WHERE 1=1
            `;
            let returnsCostSql = `
                SELECT COALESCE(SUM(srd.quantity * srd.cost_price), 0) as total
                FROM sales_return_details srd
                JOIN sales_returns sr ON srd.return_id = sr.id
                LEFT JOIN customers c ON sr.customer_id = c.id
                WHERE 1=1
            `;
            const totalParams = [];
            const costParams = [];
            const returnParams = [];
            const returnCostParams = [];
            if (startDate) {
                salesTotalSql += ` AND si.invoice_date >= ?`;
                salesCostSql += ` AND si.invoice_date >= ?`;
                returnsTotalSql += ` AND sr.return_date >= ?`;
                returnsCostSql += ` AND sr.return_date >= ?`;
                totalParams.push(startDate);
                costParams.push(startDate);
                returnParams.push(startDate);
                returnCostParams.push(startDate);
            }
            if (endDate) {
                salesTotalSql += ` AND si.invoice_date <= ?`;
                salesCostSql += ` AND si.invoice_date <= ?`;
                returnsTotalSql += ` AND sr.return_date <= ?`;
                returnsCostSql += ` AND sr.return_date <= ?`;
                totalParams.push(endDate);
                costParams.push(endDate);
                returnParams.push(endDate);
                returnCostParams.push(endDate);
            }
            if (customerName) {
                salesTotalSql += ` AND c.name LIKE ?`;
                salesCostSql += ` AND c.name LIKE ?`;
                returnsTotalSql += ` AND c.name LIKE ?`;
                returnsCostSql += ` AND c.name LIKE ?`;
                totalParams.push(`%${customerName}%`);
                costParams.push(`%${customerName}%`);
                returnParams.push(`%${customerName}%`);
                returnCostParams.push(`%${customerName}%`);
            }

            const salesTotalMonth = db.prepare(salesTotalSql).get(...totalParams).total;
            const cogsMonthSales = db.prepare(salesCostSql).get(...costParams).total;
            const salesReturnsTotalMonth = db.prepare(returnsTotalSql).get(...returnParams).total;
            const cogsMonthReturns = db.prepare(returnsCostSql).get(...returnCostParams).total;
            const salesMonth = salesTotalMonth - salesReturnsTotalMonth;
            const cogsMonth = cogsMonthSales - cogsMonthReturns;
            const totalProfit = salesMonth - cogsMonth;

            return { success: true, data: results, totalProfit };
        } catch (error) {
            console.error('[get-invoice-profit-report] Error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-invoice-profit-details', (event, invoiceId) => {
        try {
            let sql = `
                SELECT 
                    sid.id,
                    i.name as item_name,
                    sid.quantity,
                    sid.cost_price,
                    sid.sale_price,
                    (sid.sale_price - sid.cost_price) as unit_profit,
                    ((sid.sale_price - sid.cost_price) * sid.quantity) as total_profit
                FROM sales_invoice_details sid
                LEFT JOIN items i ON sid.item_id = i.id
                WHERE sid.invoice_id = ?
            `;
            const results = db.prepare(sql).all(invoiceId);
            return { success: true, data: results };
        } catch (error) {
            console.error('[get-invoice-profit-details] Error:', error);
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
        const sourceWebContents = event.sender;
        try {
            const win = BrowserWindow.fromWebContents(sourceWebContents);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().split('T')[0];
            const requestedDefault = payload?.defaultName;
            const defaultName = sanitizeSuggestedFileName(requestedDefault || `Customer_Report_${date}.pdf`);
            const defaultPath = path.join(app.getPath('downloads'), defaultName);

            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ تقرير العميل PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfBuffer = await printStandaloneCustomerReport(payload?.htmlContent, {
                printBackground: true,
                pageSize: 'A4',
                landscape: true,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
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
                        y: 10,
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

    ipcMain.handle('save-customer-summary-pdf', async (event, payload) => {
        const sourceWebContents = event.sender;
        try {
            const win = BrowserWindow.fromWebContents(sourceWebContents);
            if (!win) {
                return { success: false, error: 'No active window found' };
            }

            const date = new Date().toISOString().split('T')[0];
            const requestedDefault = payload?.defaultName;
            const defaultName = sanitizeSuggestedFileName(requestedDefault || `Customer_Summary_${date}.pdf`);
            const defaultPath = path.join(app.getPath('downloads'), defaultName);

            const { canceled, filePath } = await dialog.showSaveDialog(win, {
                title: 'حفظ فاتورة مجمعة PDF',
                defaultPath,
                filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            const pdfBuffer = await printStandaloneCustomerReport(payload?.htmlContent, {
                printBackground: true,
                pageSize: 'A4',
                landscape: false,
                margins: { top: 0, bottom: 0, left: 0, right: 0 },
                preferCSSPageSize: true
            });

            const title = path.basename(filePath, path.extname(filePath));
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            pdfDoc.setTitle(title);
            pdfDoc.setCreator('Accounting System');
            pdfDoc.setProducer('Accounting System');

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
                        y: 10,
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
            console.error('[save-customer-summary-pdf] error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
