const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const { INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');

function setupIPC() {
    const dbFilePath = db.name || path.join(app.getPath('userData'), 'accounting.db');
    // Get all units
    ipcMain.handle('get-units', () => {
        const stmt = db.prepare('SELECT * FROM units ORDER BY id DESC');
        return stmt.all();
    });

    // Add a new unit
    ipcMain.handle('add-unit', (event, unitName) => {
        try {
            const stmt = db.prepare('INSERT INTO units (name) VALUES (?)');
            const info = stmt.run(unitName);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update a unit
    ipcMain.handle('update-unit', (event, unit) => {
        try {
            const stmt = db.prepare('UPDATE units SET name = @name WHERE id = @id');
            stmt.run(unit);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete a unit
    ipcMain.handle('delete-unit', (event, id) => {
        try {
            const stmt = db.prepare('DELETE FROM units WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Warehouses Handlers ---
    ipcMain.handle('get-warehouses', () => {
        return db.prepare('SELECT * FROM warehouses ORDER BY name ASC').all();
    });

    ipcMain.handle('add-warehouse', (event, name) => {
        try {
            const stmt = db.prepare('INSERT INTO warehouses (name) VALUES (?)');
            const info = stmt.run(name);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-warehouse', (event, { id, name }) => {
        try {
            const stmt = db.prepare('UPDATE warehouses SET name = ? WHERE id = ?');
            stmt.run(name, id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-warehouse', (event, id) => {
        try {
            // Check if warehouse has items in opening balances
            const checkStmt = db.prepare('SELECT COUNT(*) as count FROM opening_balances WHERE warehouse_id = ?');
            const result = checkStmt.get(id);
            
            if (result.count > 0) {
                return { success: false, error: 'لا يمكن حذف المخزن لأنه يحتوي على أصناف مسجلة' };
            }

            const stmt = db.prepare('DELETE FROM warehouses WHERE id = ?');
            stmt.run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Opening Balances Handlers ---
    ipcMain.handle('get-opening-balances', () => {
        const stmt = db.prepare(`
            SELECT ob.*, items.name AS item_name, warehouses.name AS warehouse_name
            FROM opening_balances ob
            LEFT JOIN items ON ob.item_id = items.id
            LEFT JOIN warehouses ON ob.warehouse_id = warehouses.id
            ORDER BY ob.created_at DESC
        `);
        return stmt.all();
    });

    ipcMain.handle('save-opening-balances', (event, payload) => {
        const entries = Array.isArray(payload?.entries) ? payload.entries : [];

        const insertBalance = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);

        const clearBalances = db.prepare('DELETE FROM opening_balances');
        const updateItemStock = db.prepare('UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id');

        const tx = db.transaction((rows) => {
            clearBalances.run();

            const totalsByItem = {};
            rows.forEach((row) => {
                const quantity = Number(row.quantity) || 0;
                const cost_price = Number(row.cost_price) || 0;
                const item_id = Number(row.item_id);
                const warehouse_id = Number(row.warehouse_id);
                if (!item_id || !warehouse_id) return;

                insertBalance.run({ item_id, warehouse_id, quantity, cost_price });
                totalsByItem[item_id] = (totalsByItem[item_id] || 0) + quantity;
            });

            Object.entries(totalsByItem).forEach(([itemId, qty]) => {
                // Use last provided cost for that item if present
                const lastCost = rows.find((r) => Number(r.item_id) === Number(itemId) && Number(r.cost_price) > 0)?.cost_price || 0;
                updateItemStock.run({ id: Number(itemId), qty, cost_price: Number(lastCost) || 0 });
            });
        });

        try {
            tx(entries);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Add single opening balance entry (Append mode)
    ipcMain.handle('add-opening-balance', (event, entry) => {
        const { item_id, warehouse_id, quantity, cost_price } = entry;
        
        if (!item_id || !warehouse_id || !quantity) {
            return { success: false, error: 'Missing required fields' };
        }

        const insertStmt = db.prepare(`
            INSERT INTO opening_balances (item_id, warehouse_id, quantity, cost_price)
            VALUES (@item_id, @warehouse_id, @quantity, @cost_price)
        `);

        const getTotalsStmt = db.prepare(`
            SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?
        `);

        const updateItemStmt = db.prepare(`
            UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id
        `);

        const tx = db.transaction(() => {
            insertStmt.run({ item_id, warehouse_id, quantity, cost_price });
            const total = getTotalsStmt.get(item_id);
            updateItemStmt.run({ id: item_id, qty: total.total_qty || 0, cost_price: cost_price || 0 });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update opening balance entry
    ipcMain.handle('update-opening-balance', (event, entry) => {
        const { id, item_id, warehouse_id, quantity, cost_price } = entry;
        
        const getOldStmt = db.prepare('SELECT item_id FROM opening_balances WHERE id = ?');
        const oldRow = getOldStmt.get(id);
        if (!oldRow) return { success: false, error: 'Entry not found' };
        const oldItemId = oldRow.item_id;

        const updateStmt = db.prepare(`
            UPDATE opening_balances 
            SET item_id = @item_id, warehouse_id = @warehouse_id, quantity = @quantity, cost_price = @cost_price
            WHERE id = @id
        `);

        const getTotalsStmt = db.prepare('SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = @qty WHERE id = @id');
        const updateItemCostStmt = db.prepare('UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id');

        const tx = db.transaction(() => {
            updateStmt.run({ id, item_id, warehouse_id, quantity, cost_price });
            
            // Update new item stock
            const totalNew = getTotalsStmt.get(item_id);
            updateItemCostStmt.run({ id: item_id, qty: totalNew.total_qty || 0, cost_price: cost_price || 0 });

            // If item changed, update old item stock
            if (oldItemId !== item_id) {
                const totalOld = getTotalsStmt.get(oldItemId);
                updateItemStmt.run({ id: oldItemId, qty: totalOld.total_qty || 0 });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete opening balance entry
    ipcMain.handle('delete-opening-balance', (event, id) => {
        const getStmt = db.prepare('SELECT item_id FROM opening_balances WHERE id = ?');
        const row = getStmt.get(id);
        if (!row) return { success: false, error: 'Entry not found' };

        const deleteStmt = db.prepare('DELETE FROM opening_balances WHERE id = ?');
        const getTotalsStmt = db.prepare('SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = @qty WHERE id = @id');

        const tx = db.transaction(() => {
            deleteStmt.run(id);
            const total = getTotalsStmt.get(row.item_id);
            updateItemStmt.run({ id: row.item_id, qty: total.total_qty || 0 });
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Opening Balance Groups Handlers ---

    // Add Opening Balance Group
    ipcMain.handle('add-opening-balance-group', (event, { notes, items }) => {
        if (!items || items.length === 0) {
            return { success: false, error: 'No items provided' };
        }

        const insertGroup = db.prepare('INSERT INTO opening_balance_groups (notes) VALUES (?)');
        const insertItem = db.prepare(`
            INSERT INTO opening_balances (group_id, item_id, warehouse_id, quantity, cost_price)
            VALUES (@group_id, @item_id, @warehouse_id, @quantity, @cost_price)
        `);
        
        // Helper to update stock
        const getTotalsStmt = db.prepare('SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id');

        const tx = db.transaction(() => {
            const groupInfo = insertGroup.run(notes);
            const groupId = groupInfo.lastInsertRowid;

            for (const item of items) {
                insertItem.run({
                    group_id: groupId,
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price
                });

                // Update stock for this item
                const total = getTotalsStmt.get(item.item_id);
                updateItemStmt.run({ 
                    id: item.item_id, 
                    qty: total.total_qty || 0, 
                    cost_price: item.cost_price || 0 
                });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Get Opening Balance Groups
    ipcMain.handle('get-opening-balance-groups', () => {
        const stmt = db.prepare(`
            SELECT g.*, COUNT(ob.id) as item_count, SUM(ob.quantity * ob.cost_price) as total_value
            FROM opening_balance_groups g
            LEFT JOIN opening_balances ob ON g.id = ob.group_id
            GROUP BY g.id
            ORDER BY g.created_at DESC
        `);
        return stmt.all();
    });

    // Get Single Opening Balance Group
    ipcMain.handle('get-opening-balance-group', (event, id) => {
        return db.prepare('SELECT * FROM opening_balance_groups WHERE id = ?').get(id);
    });

    // Get Group Details
    ipcMain.handle('get-group-details', (event, groupId) => {
        const stmt = db.prepare(`
            SELECT ob.*, i.name as item_name, w.name as warehouse_name, u.name as unit_name
            FROM opening_balances ob
            LEFT JOIN items i ON ob.item_id = i.id
            LEFT JOIN warehouses w ON ob.warehouse_id = w.id
            LEFT JOIN units u ON i.unit_id = u.id
            WHERE ob.group_id = ?
        `);
        return stmt.all(groupId);
    });

    // Delete Opening Balance Group
    ipcMain.handle('delete-opening-balance-group', (event, groupId) => {
        const getItemsStmt = db.prepare('SELECT item_id FROM opening_balances WHERE group_id = ?');
        const deleteGroupStmt = db.prepare('DELETE FROM opening_balance_groups WHERE id = ?'); // Cascade deletes items
        
        // Stock update helpers
        const getTotalsStmt = db.prepare('SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = @qty WHERE id = @id');

        const tx = db.transaction(() => {
            const items = getItemsStmt.all(groupId);
            
            // Delete group (and items via cascade)
            deleteGroupStmt.run(groupId);

            // Recalculate stock for affected items
            for (const item of items) {
                const total = getTotalsStmt.get(item.item_id);
                updateItemStmt.run({ id: item.item_id, qty: total.total_qty || 0 });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Update Opening Balance Group
    ipcMain.handle('update-opening-balance-group', (event, { id, notes, items }) => {
        // 1. Get old items to recalculate their stock later
        const getOldItemsStmt = db.prepare('SELECT item_id FROM opening_balances WHERE group_id = ?');
        
        // 2. Delete old items
        const deleteOldItemsStmt = db.prepare('DELETE FROM opening_balances WHERE group_id = ?');
        
        // 3. Update Group Info
        const updateGroupStmt = db.prepare('UPDATE opening_balance_groups SET notes = ? WHERE id = ?');

        // 4. Insert New Items
        const insertItem = db.prepare(`
            INSERT INTO opening_balances (group_id, item_id, warehouse_id, quantity, cost_price)
            VALUES (@group_id, @item_id, @warehouse_id, @quantity, @cost_price)
        `);

        // 5. Stock Recalculation Helpers
        const getTotalsStmt = db.prepare('SELECT SUM(quantity) as total_qty FROM opening_balances WHERE item_id = ?');
        const updateItemStmt = db.prepare('UPDATE items SET stock_quantity = @qty, cost_price = CASE WHEN @cost_price > 0 THEN @cost_price ELSE cost_price END WHERE id = @id');

        const tx = db.transaction(() => {
            const oldItems = getOldItemsStmt.all(id);
            const affectedItemIds = new Set(oldItems.map(i => i.item_id));

            deleteOldItemsStmt.run(id);
            updateGroupStmt.run(notes, id);

            for (const item of items) {
                insertItem.run({
                    group_id: id,
                    item_id: item.item_id,
                    warehouse_id: item.warehouse_id,
                    quantity: item.quantity,
                    cost_price: item.cost_price
                });
                affectedItemIds.add(item.item_id);
            }

            // Recalculate stock for ALL affected items (both old and new)
            for (const itemId of affectedItemIds) {
                const total = getTotalsStmt.get(itemId);
                const newItem = items.find(i => i.item_id === itemId);
                const costPrice = newItem ? newItem.cost_price : 0;
                
                updateItemStmt.run({ 
                    id: itemId, 
                    qty: total.total_qty || 0, 
                    cost_price: costPrice 
                });
            }
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

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

    // Add a new item
    ipcMain.handle('add-item', (event, item) => {
        const insertItem = db.prepare(`
            INSERT INTO items (name, barcode, unit_id, cost_price, sale_price, stock_quantity, reorder_level)
            VALUES (@name, @barcode, @unit_id, @cost_price, @sale_price, @stock_quantity, @reorder_level)
        `);

        const getWarehouse = db.prepare('SELECT id FROM warehouses ORDER BY id ASC LIMIT 1');
        const createWarehouse = db.prepare("INSERT INTO warehouses (name) VALUES ('المخزن الرئيسي')");
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
            const stmt = db.prepare(`
                UPDATE items 
                SET name = @name, barcode = @barcode, unit_id = @unit_id, 
                    cost_price = @cost_price, sale_price = @sale_price, stock_quantity = @stock_quantity, reorder_level = @reorder_level
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

    // --- Customers Handlers ---

    ipcMain.handle('get-customers', () => {
        return db.prepare('SELECT * FROM customers ORDER BY name ASC').all();
    });

    ipcMain.handle('add-customer', (event, customer) => {
        try {
            const stmt = db.prepare('INSERT INTO customers (name, phone, address, balance, type) VALUES (@name, @phone, @address, @balance, @type)');
            const info = stmt.run(customer);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-customer', (event, customer) => {
        try {
            const stmt = db.prepare('UPDATE customers SET name = @name, phone = @phone, address = @address, balance = @balance, type = @type WHERE id = @id');
            stmt.run(customer);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-customer', (event, id) => {
        try {
            db.prepare('DELETE FROM customers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Suppliers Handlers ---

    ipcMain.handle('get-suppliers', () => {
        return db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
    });

    ipcMain.handle('add-supplier', (event, supplier) => {
        try {
            const stmt = db.prepare('INSERT INTO suppliers (name, phone, address, balance) VALUES (@name, @phone, @address, @balance)');
            const info = stmt.run(supplier);
            return { success: true, id: info.lastInsertRowid };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-supplier', (event, id) => {
        try {
            db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Purchase Invoices Handlers ---

    ipcMain.handle('get-purchase-invoices', () => {
        return db.prepare(`
            SELECT pi.*, c.name as supplier_name 
            FROM purchase_invoices pi
            LEFT JOIN customers c ON pi.supplier_id = c.id
            ORDER BY pi.id DESC
        `).all();
    });

    ipcMain.handle('save-purchase-invoice', (event, invoiceData) => {
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

    // --- Sales Invoices Handlers ---

    ipcMain.handle('get-sales-invoices', () => {
        return db.prepare(`
            SELECT si.*, c.name as customer_name 
            FROM sales_invoices si
            LEFT JOIN customers c ON si.customer_id = c.id
            ORDER BY si.id DESC
        `).all();
    });

    ipcMain.handle('save-sales-invoice', (event, invoiceData) => {
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

    // --- Treasury Handlers ---

    ipcMain.handle('get-treasury-balance', () => {
        try {
            const income = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'income'").get().total || 0;
            const expense = db.prepare("SELECT SUM(amount) as total FROM treasury_transactions WHERE type = 'expense'").get().total || 0;
            return income - expense;
        } catch (error) {
            console.error(error);
            return 0;
        }
    });

    ipcMain.handle('get-treasury-transactions', () => {
        return db.prepare('SELECT * FROM treasury_transactions ORDER BY transaction_date DESC, id DESC').all();
    });

    ipcMain.handle('add-treasury-transaction', (event, transaction) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO treasury_transactions (type, amount, transaction_date, description)
                VALUES (@type, @amount, @date, @description)
            `);
            stmt.run(transaction);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-treasury-transaction', (event, transaction) => {
        try {
            const stmt = db.prepare(`
                UPDATE treasury_transactions 
                SET type = @type, amount = @amount, transaction_date = @date, description = @description
                WHERE id = @id
            `);
            stmt.run(transaction);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-treasury-transaction', (event, id) => {
        const getTrans = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?');
        const deleteTrans = db.prepare('DELETE FROM treasury_transactions WHERE id = ?');
        
        // Sales Updates
        const updateSalesInvoice = db.prepare('UPDATE sales_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const updateCustomer = db.prepare('UPDATE customers SET balance = balance + @amount WHERE id = @id');
        const getSalesInvoice = db.prepare('SELECT customer_id FROM sales_invoices WHERE id = ?');

        // Purchase Updates
        const updatePurchaseInvoice = db.prepare('UPDATE purchase_invoices SET paid_amount = paid_amount - @amount, remaining_amount = remaining_amount + @amount WHERE id = @id');
        const updateSupplier = db.prepare('UPDATE suppliers SET balance = balance + @amount WHERE id = @id');
        const getPurchaseInvoice = db.prepare('SELECT supplier_id FROM purchase_invoices WHERE id = ?');

        const tx = db.transaction(() => {
            const trans = getTrans.get(id);
            if (!trans) return; // Already deleted

            if (trans.related_invoice_id) {
                if (trans.related_type === 'sales') {
                    // Revert Sales Payment
                    updateSalesInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getSalesInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.customer_id) {
                        updateCustomer.run({ amount: trans.amount, id: invoice.customer_id });
                    }
                } else if (trans.related_type === 'purchase') {
                    // Revert Purchase Payment
                    updatePurchaseInvoice.run({ amount: trans.amount, id: trans.related_invoice_id });
                    
                    const invoice = getPurchaseInvoice.get(trans.related_invoice_id);
                    if (invoice && invoice.supplier_id) {
                        updateSupplier.run({ amount: trans.amount, id: invoice.supplier_id });
                    }
                }
            }

            deleteTrans.run(id);
        });

        try {
            tx();
            return { success: true };
        } catch (error) {
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

            const query = `${purchaseQuery} UNION ALL ${salesQuery} ORDER BY date DESC, ref_number DESC`;
            
            return db.prepare(query).all({ itemId, startDate, endDate });
        } catch (error) {
            console.error(error);
            return [];
        }
    });

    // --- Dashboard Handlers ---
    ipcMain.handle('get-dashboard-stats', () => {
        try {
            const customersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('customer', 'both')").get().count;
            const suppliersCount = db.prepare("SELECT COUNT(*) as count FROM customers WHERE type IN ('supplier', 'both')").get().count;
            const itemsCount = db.prepare("SELECT COUNT(*) as count FROM items WHERE is_deleted = 0").get().count;
            
            // Calculate total stock value (cost * quantity)
            const stockValue = db.prepare("SELECT SUM(cost_price * stock_quantity) as total FROM items WHERE is_deleted = 0").get().total || 0;

            return {
                customersCount,
                suppliersCount,
                itemsCount,
                stockValue
            };
        } catch (error) {
            console.error(error);
            return { customersCount: 0, suppliersCount: 0, itemsCount: 0, stockValue: 0 };
        }
    });

    // --- Helper: Get Next Invoice Number ---
    ipcMain.handle('get-next-invoice-number', (event, type) => {
        try {
            const table = type === 'sales' ? 'sales_invoices' : 'purchase_invoices';
            const result = db.prepare(`SELECT MAX(id) as maxId FROM ${table}`).get();
            const nextId = (result.maxId || 0) + 1;
            return nextId;
        } catch (error) {
            return 1;
        }
    });

    // --- Settings Handlers ---
    ipcMain.handle('get-settings', () => {
        const rows = db.prepare('SELECT * FROM settings').all();
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        return settings;
    });

    ipcMain.handle('save-settings', (event, settings) => {
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

    // Invite Code Handlers
    ipcMain.handle('get-invite-status', () => {
        const rows = db.prepare("SELECT * FROM settings WHERE key IN ('invite_code', 'invite_expiry')").all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });

        const expiry = map.invite_expiry ? new Date(map.invite_expiry) : null;
        const now = new Date();
        const withinRange = expiry ? expiry > now : false;

        // If expiry is still valid, accept regardless of code changes
        const codeMatches = withinRange ? true : map.invite_code === INVITE_CODE;

        return {
            valid: codeMatches && withinRange,
            codeMatches,
            expiry: map.invite_expiry || null,
            requiresCode: !codeMatches || !withinRange
        };
    });

    ipcMain.handle('submit-invite-code', (event, code) => {
        if (!code || code.trim() !== INVITE_CODE) {
            return { success: false, error: 'كود الدعوة غير صحيح.' };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_DURATION_DAYS);

        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const tx = db.transaction(() => {
                stmt.run({ key: 'invite_code', value: INVITE_CODE });
                stmt.run({ key: 'invite_expiry', value: expiresAt.toISOString() });
            });
            tx();
            return { success: true, expiresAt: expiresAt.toISOString() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // --- Reports Handlers ---

    ipcMain.handle('get-all-reports', (event, filters) => {
        const { startDate, endDate, customerId, type } = filters;
        
        // Helper to build query parts
        const buildQuery = (table, typeLabel) => {
            let sql = `
                SELECT 
                    '${typeLabel}' as type,
                    i.id,
                    i.invoice_number,
                    i.invoice_date,
                    i.total_amount,
                    c.name as customer_name
                FROM ${table} i
                LEFT JOIN customers c ON i.${typeLabel === 'sales' ? 'customer_id' : 'supplier_id'} = c.id
                WHERE 1=1
            `;
            
            if (startDate) {
                sql += ` AND i.invoice_date >= @startDate`;
            }
            if (endDate) {
                sql += ` AND i.invoice_date <= @endDate`;
            }
            if (customerId) {
                sql += ` AND i.${typeLabel === 'sales' ? 'customer_id' : 'supplier_id'} = @customerId`;
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

        const sales = db.prepare(salesQuery).all(customerId);
        const purchases = db.prepare(purchaseQuery).all(customerId);
        
        // Combine and sort
        return [...sales, ...purchases].sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
    });

    ipcMain.handle('get-invoice-with-details', (event, { id, type }) => {
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
    });

    ipcMain.handle('update-sales-invoice', (event, invoiceData) => {
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

    ipcMain.handle('update-purchase-invoice', (event, invoiceData) => {
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

    ipcMain.handle('delete-invoice', (event, { id, type }) => {
        const isSales = type === 'sales';
        const invoiceTable = isSales ? 'sales_invoices' : 'purchase_invoices';
        const detailsTable = isSales ? 'sales_invoice_details' : 'purchase_invoice_details';
        const personIdField = isSales ? 'customer_id' : 'supplier_id';

        const invoice = db.prepare(`SELECT * FROM ${invoiceTable} WHERE id = ?`).get(id);
        if (!invoice) return { success: false, error: 'Invoice not found' };

        const details = db.prepare(`SELECT * FROM ${detailsTable} WHERE invoice_id = ?`).all(id);

        const transaction = db.transaction(() => {
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

            // 2. Reverse Balance (if credit/remaining > 0)
            if (invoice.remaining_amount > 0) {
                // Sales increased debt (balance), so subtract
                // Purchase increased credit (balance), so subtract (assuming balance is always positive for debt/credit)
                // Wait, usually Customer Balance = Debt. Supplier Balance = Credit.
                // Sales: Customer owes us. Balance increases. Delete -> Balance decreases.
                // Purchase: We owe supplier. Balance increases. Delete -> Balance decreases.
                // So in both cases, we subtract.
                db.prepare('UPDATE customers SET balance = balance - ? WHERE id = ?').run(invoice.remaining_amount, invoice[personIdField]);
            }

            // 3. Reverse Treasury (if paid > 0)
            if (invoice.paid_amount > 0) {
                // Delete the treasury transaction
                db.prepare('DELETE FROM treasury_transactions WHERE related_invoice_id = ? AND related_type = ?').run(id, type);
            }

            // 4. Delete Details
            db.prepare(`DELETE FROM ${detailsTable} WHERE invoice_id = ?`).run(id);

            // 5. Delete Invoice
            db.prepare(`DELETE FROM ${invoiceTable} WHERE id = ?`).run(id);
        });

        try {
            transaction();
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    });

    // --- Backup & Restore Handlers ---

    ipcMain.handle('backup-database', async () => {
        try {
            const defaultName = `accounting-backup-${new Date().toISOString().slice(0, 10)}.db`;
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'حفظ نسخة احتياطية',
                defaultPath: path.join(app.getPath('documents'), defaultName),
                filters: [{ name: 'SQLite Database', extensions: ['db'] }],
                properties: ['createDirectory', 'showOverwriteConfirmation']
            });

            if (canceled || !filePath) {
                return { success: false, canceled: true };
            }

            await db.backup(filePath);
            return { success: true, path: filePath };
        } catch (error) {
            console.error('[backup-database] error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('restore-database', async () => {
        let safetyPath = null;
        let dbWasClosed = false;

        try {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                title: 'استعادة نسخة احتياطية',
                filters: [{ name: 'SQLite Database', extensions: ['db'] }],
                properties: ['openFile']
            });

            if (canceled || !filePaths || filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const sourcePath = filePaths[0];
            safetyPath = path.join(app.getPath('userData'), `pre-restore-${Date.now()}.db`);

            // Create a safety backup before replacing the live database
            await db.backup(safetyPath);

            // Replace the live database with the selected backup
            db.close();
            dbWasClosed = true;
            fs.copyFileSync(sourcePath, dbFilePath);

            return { success: true, restoredFrom: sourcePath, safetyBackup: safetyPath, needsRestart: true };
        } catch (error) {
            console.error('[restore-database] error:', error);
            if (dbWasClosed && safetyPath) {
                try {
                    fs.copyFileSync(safetyPath, dbFilePath);
                } catch (restoreError) {
                    console.error('[restore-database] rollback failed:', restoreError);
                }
            }
            return { success: false, error: error.message, safetyBackup: safetyPath, needsRestart: dbWasClosed };
        }
    });

    ipcMain.handle('restart-app', () => {
        app.relaunch();
        app.exit(0);
        return { success: true };
    });
}

module.exports = { setupIPC };