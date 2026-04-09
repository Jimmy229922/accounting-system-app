const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const BACKUP_FOLDER_NAME = 'PIC';
const MANUAL_BACKUP_FILE_NAME = 'accounting-manual-backup.db';

function getProgramRootPath() {
    const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
    if (configuredRoot) {
        return configuredRoot;
    }

    if (app.isPackaged) {
        const { shell } = require('electron');
        const desktopPath = app.getPath('desktop');
        const appFolder = path.join(desktopPath, 'برنامج الحسابات');
        
        if (!fs.existsSync(appFolder)) {
            fs.mkdirSync(appFolder, { recursive: true });
        }
        
        const shortcutPath = path.join(appFolder, 'تشغيل نظام الحسابات.lnk');
        if (!fs.existsSync(shortcutPath)) {
            shell.writeShortcutLink(shortcutPath, 'create', {
                target: process.execPath,
                description: 'برنامج الحسابات'
            });
        }
        
        return appFolder;
    }
    return path.resolve(__dirname, '../../../..');
}

function getSharedBackupRootPath() {
    const backupRootPath = path.join(getProgramRootPath(), BACKUP_FOLDER_NAME);
    fs.mkdirSync(backupRootPath, { recursive: true });
    return backupRootPath;
}

function register() {
    const dbFilePath = db.name || path.join(app.getPath('userData'), 'accounting.db');

    // --- Backup & Restore Handlers ---

    ipcMain.handle('backup-database', async () => {
        try {
            const defaultDir = getSharedBackupRootPath();
            const defaultPath = path.join(defaultDir, MANUAL_BACKUP_FILE_NAME);

            const { canceled, filePath: chosenPath } = await dialog.showSaveDialog({
                title: 'حفظ نسخة احتياطية',
                defaultPath: defaultPath,
                filters: [{ name: 'SQLite Database', extensions: ['db'] }]
            });

            if (canceled || !chosenPath) {
                return { success: false, canceled: true };
            }

            const targetDir = path.dirname(chosenPath);
            fs.mkdirSync(targetDir, { recursive: true });

            await db.backup(chosenPath);
            return { success: true, path: chosenPath };
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
                title: 'Restore backup',
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
        try {
            app.relaunch();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('[restart-app] Error:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
