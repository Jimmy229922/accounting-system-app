const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

function register() {
    const dbFilePath = db.name || path.join(app.getPath('userData'), 'accounting.db');

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
        app.quit();
        return { success: true };
    });
}

module.exports = { register };
