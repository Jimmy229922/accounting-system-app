const { ipcMain } = require('electron');
const { db } = require('../db');

function register() {
    // --- Items Handlers ---

    // Get all items
    ipcMain.handle('get-items', () => {
        const stmt = db.prepare(`
            SELECT items.*, units.name as unit_name 
            FROM items 
            LEFT JOIN units ON items.unit_id = units.id 
            WHERE items.is_deleted = 0
            ORDER BY items.name ASC
        `);
        return stmt.all();
    });

    // Get Item Stock Details
    ipcMain.handle('get-item-stock-details', (event, itemId) => {
        try {
            const openingBalance = db.prepare('SELECT SUM(quantity) as total FROM opening_balances WHERE item_id = ?').get(itemId).total || 0;
            const purchases = db.prepare('SELECT SUM(quantity) as total FROM purchase_invoice_details WHERE item_id = ?').get(itemId).total || 0;
            const sales = db.prepare('SELECT SUM(quantity) as total FROM sales_invoice_details WHERE item_id = ?').get(itemId).total || 0;
            const item = db.prepare('SELECT stock_quantity FROM items WHERE id = ?').get(itemId);
            
            return {
                success: true,
                openingBalance,
                purchases,
                sales,
                currentStock: item ? item.stock_quantity : 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Add a new item
    ipcMain.handle('add-item', (event, item) => {
        const insertItem = db.prepare(`
            INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level)
            VALUES (@name, @barcode, @unit_id, @cost_price, @sale_price, @stock_quantity, @reorder_level)
        `);

        const getWarehouse = db.prepare('SELECT id FROM warehouses ORDER BY id ASC LIMIT 1');
        const createWarehouse = db.prepare("INSERT INTO warehouses (name) VALUES ('المخزن الافتراضي')");
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
                    const wInfo = createWarehouse.run();
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
        try {
            // Removed stock_quantity from update to prevent manual override
            const stmt = db.prepare(`
                UPDATE items 
                SET name = @name, barcode = @barcode, unit_id = @unit_id, 
                    cost_price = @cost_price, sale_price = @sale_price, reorder_level = @reorder_level
                WHERE id = @id
            `);
            stmt.run(item);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete an item
    ipcMain.handle('delete-item', (event, id) => {
        try {
            // Check for transactions
            const checkOpening = db.prepare('SELECT COUNT(*) as count FROM opening_balances WHERE item_id = ?').get(id);
            if (checkOpening.count > 0) {
                return { success: false, error: 'لا يمكن حذف الصنف لأنه مسجل في بضاعة أول المدة' };
            }

            const checkPurchases = db.prepare('SELECT COUNT(*) as count FROM purchase_invoice_details WHERE item_id = ?').get(id);
            if (checkPurchases.count > 0) {
                return { success: false, error: 'لا يمكن حذف الصنف لأنه مسجل في فواتير شراء' };
            }

            const checkSales = db.prepare('SELECT COUNT(*) as count FROM sales_invoice_details WHERE item_id = ?').get(id);
            if (checkSales.count > 0) {
                return { success: false, error: 'لا يمكن حذف الصنف لأنه مسجل في فواتير بيع' };
            }

            // Soft delete: mark as deleted and append timestamp to barcode to avoid unique constraint issues
            const stmt = db.prepare(`
                UPDATE items 
                SET is_deleted = 1, 
                    barcode = barcode || '_del_' || strftime('%s','now') 
                WHERE id = ?
            `);
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Item Movements Handler ---
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

    // --- Inventory Handlers ---

    ipcMain.handle('get-item-transactions', (event, payload) => {
        try {
            let itemId, startDate, endDate;

            // Handle both object (new) and direct ID (old) arguments
            if (typeof payload === 'object' && payload !== null) {
                ({ itemId, startDate, endDate } = payload);
            } else {
                itemId = payload;
                startDate = null;
                endDate = null;
            }

            const purchaseQuery = `
                SELECT 
                    'purchase' as type, 
                    pi.invoice_date as date, 
                    pi.invoice_number as ref_number, 
                    c.name as party_name, 
                    pid.quantity as quantity_in, 
                    0 as quantity_out,
                    pid.cost_price as price
                FROM purchase_invoice_details pid
                JOIN purchase_invoices pi ON pid.invoice_id = pi.id
                LEFT JOIN customers c ON pi.supplier_id = c.id
                WHERE pid.item_id = @itemId
                ${startDate ? 'AND pi.invoice_date >= @startDate' : ''}
                ${endDate ? 'AND pi.invoice_date <= @endDate' : ''}
            `;

            const salesQuery = `
                SELECT 
                    'sale' as type, 
                    si.invoice_date as date, 
                    si.invoice_number as ref_number, 
                    c.name as party_name, 
                    0 as quantity_in, 
                    sid.quantity as quantity_out,
                    sid.sale_price as price
                FROM sales_invoice_details sid
                JOIN sales_invoices si ON sid.invoice_id = si.id
                LEFT JOIN customers c ON si.customer_id = c.id
                WHERE sid.item_id = @itemId
                ${startDate ? 'AND si.invoice_date >= @startDate' : ''}
                ${endDate ? 'AND si.invoice_date <= @endDate' : ''}
            `;

            const openingQuery = `
                SELECT 
                    'opening' as type,
                    ob.created_at as date,
                    ob.id as ref_number,
                    w.name as party_name,
                    ob.quantity as quantity_in,
                    0 as quantity_out,
                    ob.cost_price as price
                FROM opening_balances ob
                LEFT JOIN warehouses w ON ob.warehouse_id = w.id
                WHERE ob.item_id = @itemId
                ${startDate ? 'AND ob.created_at >= @startDate' : ''}
                ${endDate ? 'AND ob.created_at <= @endDate' : ''}
            `;

            const query = `${openingQuery} UNION ALL ${purchaseQuery} UNION ALL ${salesQuery} ORDER BY date DESC, ref_number DESC`;
            
            return db.prepare(query).all({ itemId, startDate, endDate });
        } catch (error) {
            console.error(error);
            return [];
        }
    });
}

module.exports = { register };
