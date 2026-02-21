const { ipcMain } = require('electron');
const { db } = require('../db');
const { requirePermission } = require('./auth');

function register() {
    // --- Settings Handlers ---
    ipcMain.handle('get-settings', () => {
        try {
            const rows = db.prepare('SELECT * FROM settings').all();
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = row.value;
            });
            return settings;
        } catch (error) {
            console.error('[get-settings] Error:', error);
            return {};
        }
    });

    ipcMain.handle('save-settings', (event, settings) => {
        const denied = requirePermission('settings', 'edit');
        if (denied) return denied;
        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const transaction = db.transaction((data) => {
                for (const [key, value] of Object.entries(data)) {
                    stmt.run({ key, value });
                }
            });
            transaction(settings);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Dashboard Handlers ---
    ipcMain.handle('get-dashboard-stats', () => {
        try {
            const now = new Date();
            const today = now.toISOString().slice(0, 10);
            const thisMonth = today.slice(0, 7);
            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);

            // --- Basic counts ---
            const customersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('customer', 'both')").get().count;
            const suppliersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('supplier', 'both')").get().count;
            const itemsCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE is_deleted = 0").get().count;
            const stockValue = db.prepare("SELECT COALESCE(SUM(cost_price * stock_quantity), 0) as total FROM items WHERE is_deleted = 0").get().total;

            // --- Sales & Purchases ---
            const salesToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_invoices WHERE invoice_date = ?").get(today).total;
            const salesMonth = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_invoices WHERE invoice_date LIKE ?").get(thisMonth + '%').total;
            const purchasesToday = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_invoices WHERE invoice_date = ?").get(today).total;
            const purchasesMonth = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_invoices WHERE invoice_date LIKE ?").get(thisMonth + '%').total;

            // --- Net profit (sales revenue - COGS this month) ---
            const cogsMonth = db.prepare(`
                SELECT COALESCE(SUM(sid.quantity * i.cost_price), 0) as total
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                JOIN items i ON sid.item_id = i.id
                WHERE si.invoice_date LIKE ?
            `).get(thisMonth + '%').total;
            const netProfit = salesMonth - cogsMonth;

            // --- Treasury balance ---
            const treasuryIncome = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'income'").get().total;
            const treasuryExpense = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense'").get().total;
            const treasuryBalance = treasuryIncome - treasuryExpense;

            // --- Receivables & Payables ---
            const receivables = db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as total FROM sales_invoices WHERE remaining_amount > 0").get().total;
            const payables = db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as total FROM purchase_invoices WHERE remaining_amount > 0").get().total;

            // --- Chart data (last 30 days) ---
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
            const dailySales = db.prepare(`
                SELECT invoice_date as date, COALESCE(SUM(total_amount), 0) as total
                FROM sales_invoices WHERE invoice_date >= ?
                GROUP BY invoice_date ORDER BY invoice_date
            `).all(thirtyDaysAgo);
            const dailyPurchases = db.prepare(`
                SELECT invoice_date as date, COALESCE(SUM(total_amount), 0) as total
                FROM purchase_invoices WHERE invoice_date >= ?
                GROUP BY invoice_date ORDER BY invoice_date
            `).all(thirtyDaysAgo);

            // --- Recent transactions ---
            const recentSales = db.prepare(`
                SELECT si.id, si.invoice_number, si.invoice_date as date,
                       si.total_amount as amount, c.name as party_name, 'sale' as type
                FROM sales_invoices si
                LEFT JOIN customers c ON si.customer_id = c.id
                ORDER BY si.created_at DESC LIMIT 5
            `).all();
            const recentPurchases = db.prepare(`
                SELECT pi.id, pi.invoice_number, pi.invoice_date as date,
                       pi.total_amount as amount, c.name as party_name, 'purchase' as type
                FROM purchase_invoices pi
                LEFT JOIN customers c ON pi.supplier_id = c.id
                ORDER BY pi.created_at DESC LIMIT 5
            `).all();
            const recentTransactions = [...recentSales, ...recentPurchases]
                .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

            // --- Alerts ---
            const lowStockItems = db.prepare(`
                SELECT name, stock_quantity, reorder_level FROM items
                WHERE is_deleted = 0 AND reorder_level > 0 AND stock_quantity <= reorder_level
                ORDER BY stock_quantity ASC LIMIT 5
            `).all();
            const highReceivables = db.prepare(`
                SELECT c.name, COALESCE(SUM(si.remaining_amount), 0) as amount
                FROM sales_invoices si
                JOIN customers c ON si.customer_id = c.id
                WHERE si.remaining_amount > 0
                GROUP BY si.customer_id ORDER BY amount DESC LIMIT 3
            `).all();
            const oldInvoices = db.prepare(`
                SELECT invoice_number, remaining_amount as amount, invoice_date,
                       CAST(julianday('now') - julianday(invoice_date) AS INTEGER) as days_old
                FROM sales_invoices
                WHERE remaining_amount > 0 AND julianday('now') - julianday(invoice_date) > 30
                ORDER BY invoice_date ASC LIMIT 3
            `).all();

            // --- Today summary ---
            const todaySalesCount = db.prepare("SELECT COUNT(*) as count FROM sales_invoices WHERE invoice_date = ?").get(today).count;
            const todayPurchasesCount = db.prepare("SELECT COUNT(*) as count FROM purchase_invoices WHERE invoice_date = ?").get(today).count;
            const todayCollections = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'income' AND transaction_date = ?").get(today).total;
            const todayPaymentsTotal = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM treasury_transactions WHERE type = 'expense' AND transaction_date = ?").get(today).total;

            // --- Top selling items ---
            const topItems = db.prepare(`
                SELECT i.name, SUM(sid.quantity) as total_qty, SUM(sid.total_price) as total_value
                FROM sales_invoice_details sid
                JOIN items i ON sid.item_id = i.id
                GROUP BY sid.item_id ORDER BY total_qty DESC LIMIT 5
            `).all();

            // --- Trends (current vs previous month) ---
            const prevSalesMonth = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_invoices WHERE invoice_date LIKE ?").get(prevMonthStr + '%').total;
            const prevPurchasesMonth = db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_invoices WHERE invoice_date LIKE ?").get(prevMonthStr + '%').total;

            function calcTrend(current, previous) {
                if (previous === 0) return current > 0 ? 100 : 0;
                return Math.round(((current - previous) / previous) * 100);
            }

            return {
                customersCount, suppliersCount, itemsCount, stockValue,
                salesToday, salesMonth, purchasesToday, purchasesMonth,
                netProfit, treasuryBalance, receivables, payables,
                chartData: { dailySales, dailyPurchases },
                recentTransactions,
                alerts: { lowStockItems, highReceivables, oldInvoices },
                todaySummary: {
                    invoiceCount: todaySalesCount + todayPurchasesCount,
                    salesTotal: salesToday,
                    collections: todayCollections,
                    payments: todayPaymentsTotal
                },
                topItems,
                trends: {
                    salesMonth: calcTrend(salesMonth, prevSalesMonth),
                    purchasesMonth: calcTrend(purchasesMonth, prevPurchasesMonth)
                }
            };
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            return { customersCount: 0, suppliersCount: 0, itemsCount: 0, stockValue: 0 };
        }
    });
}

module.exports = { register };
