const { db } = require('./db');
const BALANCE_REPAIR_FLAG_KEY = 'balance_repair_v1_completed';

function roundMoney(value) {
    const n = Number(value) || 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function runSilentBalanceRepair() {
    const existingFlag = db.prepare('SELECT value FROM settings WHERE key = ?').get(BALANCE_REPAIR_FLAG_KEY);
    if (existingFlag && String(existingFlag.value || '').trim() !== '') {
        return false;
    }

    console.log('[Repair System] Initiating complete balance reconstruction check...');

    const customers = db.prepare('SELECT id, opening_balance FROM customers').all();

    const salesStmt = db.prepare(`
        SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS net_sales
        FROM sales_invoices
        WHERE customer_id = ?
    `);

    const purchasesStmt = db.prepare(`
        SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS net_purchases
        FROM purchase_invoices
        WHERE supplier_id = ?
    `);

    const salesReturnsStmt = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS net_sales_returns
        FROM sales_returns
        WHERE customer_id = ?
    `);

    const purchaseReturnsStmt = db.prepare(`
        SELECT COALESCE(SUM(total_amount), 0) AS net_purchase_returns
        FROM purchase_returns
        WHERE supplier_id = ?
    `);

    const treasuryStmt = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE -amount END), 0) AS net_treasury
        FROM treasury_transactions
        WHERE customer_id = ?
    `);

    const updateStmt = db.prepare('UPDATE customers SET balance = ? WHERE id = ?');
    const saveFlagStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const tx = db.transaction(() => {
        for (const record of customers) {
            const id = Number(record.id);
            const openingBalance = Number(record.opening_balance) || 0;
            const netSales = Number(salesStmt.get(id)?.net_sales) || 0;
            const netPurchases = Number(purchasesStmt.get(id)?.net_purchases) || 0;
            const netSalesReturns = Number(salesReturnsStmt.get(id)?.net_sales_returns) || 0;
            const netPurchaseReturns = Number(purchaseReturnsStmt.get(id)?.net_purchase_returns) || 0;
            const netTreasury = Number(treasuryStmt.get(id)?.net_treasury) || 0;

            const correctBalance = roundMoney(
                openingBalance
                + netSales
                - netPurchases
                - netSalesReturns
                + netPurchaseReturns
                + netTreasury
            );

            updateStmt.run(correctBalance, id);
        }

        saveFlagStmt.run(BALANCE_REPAIR_FLAG_KEY, new Date().toISOString());
    });

    tx();

    console.log('[Repair System] Balance reconstruction successfully finalized. All discrepancies resolved.');
    return true;
}

module.exports = { runSilentBalanceRepair };
