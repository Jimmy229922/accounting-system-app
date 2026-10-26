const { ipcMain } = require('electron');
const { db } = require('../db');

function getNextExpenseVoucherNumber() {
    const maxResult = db.prepare(`
        SELECT MAX(CAST(SUBSTR(voucher_number, 5) AS INTEGER)) as max_num
        FROM expenses
        WHERE voucher_number GLOB 'NTH-[0-9]*'
    `).get();

    const nextNumber = Number(maxResult?.max_num || 0) + 1;
    return `NTH-${String(nextNumber).padStart(4, '0')}`;
}

function register() {
    ipcMain.handle('get-expenses', () => {
        try {
            return db.prepare('SELECT * FROM expenses ORDER BY transaction_date DESC, id DESC').all();
        } catch (error) {
            console.error('[get-expenses] Error:', error);
            return [];
        }
    });

    ipcMain.handle('get-next-expense-voucher-number', () => {
        try {
            return { success: true, voucher_number: getNextExpenseVoucherNumber() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('add-expense', (event, data = {}) => {
        try {
            const amount = parseFloat(data.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
                return { success: false, error: 'المبلغ غير صحيح' };
            }
            const date = data.date || new Date().toISOString().slice(0, 10);
            const description = String(data.description || '').trim();
            if (!description) {
                return { success: false, error: 'البيان مطلوب' };
            }
            const notes = String(data.notes || '').trim();
            const voucher_number = data.voucher_number || getNextExpenseVoucherNumber();

            const stmt = db.prepare(`
                INSERT INTO expenses (voucher_number, amount, transaction_date, description, notes)
                VALUES (@voucher_number, @amount, @date, @description, @notes)
            `);
            const info = stmt.run({ voucher_number, amount, date, description, notes });
            return { success: true, id: info.lastInsertRowid, voucher_number };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('update-expense', (event, data = {}) => {
        try {
            const id = Number(data.id);
            const amount = parseFloat(data.amount);
            if (!Number.isFinite(id) || !Number.isFinite(amount) || amount <= 0) {
                return { success: false, error: 'بيانات غير صالحة' };
            }
            const date = data.date || new Date().toISOString().slice(0, 10);
            const description = String(data.description || '').trim();
            if (!description) {
                return { success: false, error: 'البيان مطلوب' };
            }
            const notes = String(data.notes || '').trim();

            const stmt = db.prepare(`
                UPDATE expenses
                SET amount = @amount, transaction_date = @date, description = @description, notes = @notes
                WHERE id = @id
            `);
            stmt.run({ id, amount, date, description, notes });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('delete-expense', (event, id) => {
        try {
            const parsedId = Number(id);
            if (!Number.isFinite(parsedId)) {
                return { success: false, error: 'معرف غير صالح' };
            }
            db.prepare('DELETE FROM expenses WHERE id = ?').run(parsedId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register, getNextExpenseVoucherNumber };
