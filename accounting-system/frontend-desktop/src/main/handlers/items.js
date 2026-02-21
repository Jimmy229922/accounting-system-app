const { ipcMain } = require('electron');
const { db } = require('../db');
const { DEFAULT_WAREHOUSE_NAME } = require('./utils');
const { requirePermission } = require('./auth');

function register() {
    // Get all items
    ipcMain.handle('get-items', () => {
        try {
            const stmt = db.prepare(`
                SELECT items.*, units.name as unit_name
                FROM items
                LEFT JOIN units ON items.unit_id = units.id
                WHERE items.is_deleted = 0
                ORDER BY items.id DESC
            `);
            return stmt.all();
        } catch (error) {
            console.error('[get-items] Error:', error);
            return [];
        }
    });

    // Get item stock details (warehouse breakdown)
    ipcMain.handle('get-item-stock-details', (event, itemId) => {
        try {
            const stmt = db.prepare(`
                SELECT 
                    ob.id,
                    ob.warehouse_id,
                    w.name as warehouse_name,
                    ob.quantity,
                    ob.cost_price
                FROM opening_balances ob
                JOIN warehouses w ON ob.warehouse_id = w.id
                WHERE ob.item_id = ?
                ORDER BY w.name
            `);
            return stmt.all(itemId);
        } catch (error) {
            console.error('[get-item-stock-details] Error:', error);
            return [];
        }
    });

    // Add a new item
    ipcMain.handle('add-item', (event, item) => {
        const denied = requirePermission('items', 'add');
        if (denied) return denied;
        const insertItem = db.prepare(`
            INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level)
            VALUES (@name, @barcode, @unit_id, @cost_price, @sale_price, @stock_quantity, @reorder_level)
        `);

        const getWarehouse = db.prepare('SELECT id FROM warehouses ORDER BY id ASC LIMIT 1');
        const createWarehouse = db.prepare('INSERT INTO warehouses (name) VALUES (?)');
        const insertBalance = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (?, ?, ?, ?)
        `);

        const tx = db.transaction((item) => {
            const info = insertItem.run(item);
            const itemId = info.lastInsertRowid;

            if (item.stock_quantity > 0) {
                let warehouse = getWarehouse.get();
                if (!warehouse) {
                    const wInfo = createWarehouse.run(DEFAULT_WAREHOUSE_NAME);
                    warehouse = { id: wInfo.lastInsertRowid };
                }
                insertBalance.run(itemId, warehouse.id, item.stock_quantity, item.cost_price || 0);
            }
            return itemId;
        });

        try {
            const id = tx(item);
            return { success: true, id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update an item
    ipcMain.handle('update-item', (event, item) => {
        const denied = requirePermission('items', 'edit');
        if (denied) return denied;
        try {
            // Removed stock_quantity from update to prevent manual override
            const stmt = db.prepare(`
                UPDATE items SET
                    name = @name,
                    barcode = @barcode,
                    unit_id = @unit_id,
                    cost_price = @cost_price,
                    sale_price = @sale_price,
                    reorder_level = @reorder_level
                WHERE id = @id
            `);
            stmt.run(item);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete an item (soft delete)
    ipcMain.handle('delete-item', (event, id) => {
        const denied = requirePermission('items', 'delete');
        if (denied) return denied;
        try {
            // Check for any references in sales_invoice_details or purchase_invoice_details
            const salesRef = db.prepare('SELECT COUNT(*) as count FROM sales_invoice_details WHERE item_id = ?').get(id);
            const purchaseRef = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_details WHERE item_id = ?').get(id);

            if (salesRef.count > 0 || purchaseRef.count > 0) {
                // Soft delete - mark as deleted instead of removing
                const stmt = db.prepare('UPDATE items SET is_deleted = 1 WHERE id = ?');
                stmt.run(id);
                return { success: true, softDeleted: true };
            }

            // delete related opening balances first
            db.prepare('DELETE FROM opening_balances WHERE item_id = ?').run(id);
            // Hard delete if no references
            const stmt = db.prepare('DELETE FROM items WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get item movements (stock changes from invoices)
    ipcMain.handle('get-item-movements', (event, itemId) => {
        try {
            // الحصول على معلومات الصنف مع اسم الوحدة
            const item = db.prepare(`
                SELECT i.*, u.name as unit_name 
                FROM items i 
                LEFT JOIN units u ON i.unit_id = u.id 
                WHERE i.id = ?
            `).get(itemId);
            if (!item) {
                return { success: false, error: 'الصنف غير موجود' };
            }

            // حركات المشتريات (وارد)
            const purchases = db.prepare(`
                SELECT 
                    pid.id,
                    pi.invoice_number,
                    pi.invoice_date as date,
                    c.name as party_name,
                    pid.quantity,
                    pid.cost_price as price,
                    pid.total_price,
                    'purchase' as type,
                    'وارد - مشتريات' as type_label
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
                LEFT JOIN customers c ON pi.supplier_id = c.id
                WHERE pid.item_id = ?
                ORDER BY pi.invoice_date DESC
            `).all(itemId);

            // حركات المبيعات (صادر)
            const sales = db.prepare(`
                SELECT 
                    sid.id,
                    si.invoice_number,
                    si.invoice_date as date,
                    c.name as party_name,
                    sid.quantity,
                    sid.sale_price as price,
                    sid.total_price,
                    'sale' as type,
                    'صادر - مبيعات' as type_label
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE sid.item_id = ?
                ORDER BY si.invoice_date DESC
            `).all(itemId);

            // حركات مرتجعات المبيعات (وارد)
            const salesReturns = db.prepare(`
                SELECT 
                    srd.id,
                    CAST(sr.id AS TEXT) as invoice_number,
                    sr.return_date as date,
                    c.name as party_name,
                    srd.quantity,
                    srd.price,
                    (srd.quantity * srd.price) as total_price,
                    'sales_return' as type,
                    'وارد - مرتجع مبيعات' as type_label
                FROM sales_return_details srd
                JOIN sales_returns sr ON srd.return_id = sr.id
                LEFT JOIN customers c ON sr.customer_id = c.id
                WHERE srd.item_id = ?
                ORDER BY sr.return_date DESC
            `).all(itemId);

            // حركات مرتجعات المشتريات (صادر)
            const purchaseReturns = db.prepare(`
                SELECT 
                    prd.id,
                    CAST(pr.id AS TEXT) as invoice_number,
                    pr.return_date as date,
                    c.name as party_name,
                    prd.quantity,
                    prd.price,
                    (prd.quantity * prd.price) as total_price,
                    'purchase_return' as type,
                    'صادر - مرتجع مشتريات' as type_label
                FROM purchase_return_details prd
                JOIN purchase_returns pr ON prd.return_id = pr.id
                LEFT JOIN customers c ON pr.supplier_id = c.id
                WHERE prd.item_id = ?
                ORDER BY pr.return_date DESC
            `).all(itemId);

            // حركات بضاعة أول المدة (رصيد افتتاحي)
            const openingBalances = db.prepare(`
                SELECT 
                    ob.id,
                    'رصيد افتتاحي' as invoice_number,
                    ob.created_at as date,
                    w.name as party_name,
                    ob.quantity,
                    ob.cost_price as price,
                    (ob.quantity * ob.cost_price) as total_price,
                    'opening' as type,
                    'وارد - رصيد افتتاحي' as type_label
                FROM opening_balances ob
                LEFT JOIN warehouses w ON ob.warehouse_id = w.id
                WHERE ob.item_id = ?
                ORDER BY ob.created_at DESC
            `).all(itemId);

            // دمج جميع الحركات وترتيبها بالتاريخ
            const allMovements = [...purchases, ...sales, ...salesReturns, ...purchaseReturns, ...openingBalances]
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            // حساب الإحصائيات
            const totalPurchased = purchases.reduce((sum, p) => sum + p.quantity, 0);
            const totalSold = sales.reduce((sum, s) => sum + s.quantity, 0);
            const totalOpening = openingBalances.reduce((sum, o) => sum + o.quantity, 0);

            return {
                success: true,
                item: item,
                movements: allMovements,
                stats: {
                    totalPurchased,
                    totalSold,
                    totalOpening,
                    currentStock: item.stock_quantity || 0,
                    purchaseCount: purchases.length,
                    salesCount: sales.length
                }
            };
        } catch (error) {
            console.error('Error getting item movements:', error);
            return { success: false, error: error.message };
        }
    });

    // Get item transactions with running balance
    ipcMain.handle('get-item-transactions', (event, payload) => {
        try {
        const { itemId, warehouseId, startDate, endDate } = payload;
        
        // Get opening balance for this item/warehouse
        let openingQuery = `
            SELECT COALESCE(SUM(quantity), 0) as opening_qty
            FROM opening_balances
            WHERE item_id = ?
        `;
        const openingParams = [itemId];
        if (warehouseId) {
            openingQuery += ' AND warehouse_id = ?';
            openingParams.push(warehouseId);
        }
        const openingRow = db.prepare(openingQuery).get(...openingParams);
        const openingQty = openingRow ? openingRow.opening_qty : 0;

        // purchases (in)
        let purchaseQuery = `
            SELECT 
                'purchase' as type,
                pi.invoice_date as date,
                pi.invoice_number as ref,
                pid.quantity as qty_in,
                0 as qty_out,
                pid.cost_price as price,
                c.name as party
            FROM purchase_invoice_details pid
            JOIN purchase_invoices pi ON pid.invoice_id = pi.id
            LEFT JOIN customers c ON pi.supplier_id = c.id
            WHERE pid.item_id = ?
        `;
        const purchaseParams = [itemId];
        if (startDate) { purchaseQuery += ' AND pi.invoice_date >= ?'; purchaseParams.push(startDate); }
        if (endDate) { purchaseQuery += ' AND pi.invoice_date <= ?'; purchaseParams.push(endDate); }

        // sales (out)
        let salesQuery = `
            SELECT 
                'sale' as type,
                si.invoice_date as date,
                si.invoice_number as ref,
                0 as qty_in,
                sid.quantity as qty_out,
                sid.sale_price as price,
                c.name as party
            FROM sales_invoice_details sid
            JOIN sales_invoices si ON sid.invoice_id = si.id
            LEFT JOIN customers c ON si.customer_id = c.id
            WHERE sid.item_id = ?
        `;
        const salesParams = [itemId];
        if (startDate) { salesQuery += ' AND si.invoice_date >= ?'; salesParams.push(startDate); }
        if (endDate) { salesQuery += ' AND si.invoice_date <= ?'; salesParams.push(endDate); }

        // sales returns (in)
        let srQuery = `
            SELECT 
                'sales_return' as type,
                sr.return_date as date,
                CAST(sr.id AS TEXT) as ref,
                srd.quantity as qty_in,
                0 as qty_out,
                srd.price as price,
                c.name as party
            FROM sales_return_details srd
            JOIN sales_returns sr ON srd.return_id = sr.id
            LEFT JOIN customers c ON sr.customer_id = c.id
            WHERE srd.item_id = ?
        `;
        const srParams = [itemId];
        if (startDate) { srQuery += ' AND sr.return_date >= ?'; srParams.push(startDate); }
        if (endDate) { srQuery += ' AND sr.return_date <= ?'; srParams.push(endDate); }

        // purchase returns (out)
        let prQuery = `
            SELECT 
                'purchase_return' as type,
                pr.return_date as date,
                CAST(pr.id AS TEXT) as ref,
                0 as qty_in,
                prd.quantity as qty_out,
                prd.price as price,
                c.name as party
            FROM purchase_return_details prd
            JOIN purchase_returns pr ON prd.return_id = pr.id
            LEFT JOIN customers c ON pr.supplier_id = c.id
            WHERE prd.item_id = ?
        `;
        const prParams = [itemId];
        if (startDate) { prQuery += ' AND pr.return_date >= ?'; prParams.push(startDate); }
        if (endDate) { prQuery += ' AND pr.return_date <= ?'; prParams.push(endDate); }

        const purchases = db.prepare(purchaseQuery).all(...purchaseParams);
        const sales = db.prepare(salesQuery).all(...salesParams);
        const salesReturns = db.prepare(srQuery).all(...srParams);
        const purchaseReturns = db.prepare(prQuery).all(...prParams);

        const allTx = [...purchases, ...sales, ...salesReturns, ...purchaseReturns]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let balance = openingQty;
        for (const tx of allTx) {
            balance = balance + tx.qty_in - tx.qty_out;
            tx.balance = balance;
        }

        return { openingQty, transactions: allTx };
        } catch (error) {
            console.error('[get-item-transactions] Error:', error);
            return { openingQty: 0, transactions: [] };
        }
    });
}

module.exports = { register };
