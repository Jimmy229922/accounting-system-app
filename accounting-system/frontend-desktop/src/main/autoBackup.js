const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

const AUTO_BACKUP_FOLDER_NAME = 'DATA';
const AUTO_BACKUP_FILE_NAME = 'accounting-auto-backup.db';

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
    return path.resolve(__dirname, '../../..');
}

function removeFileIfExists(filePath) {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

function getBackupPaths() {
    const programRootPath = getProgramRootPath();
    const backupRootPath = path.join(programRootPath, AUTO_BACKUP_FOLDER_NAME);
    const backupFilePath = path.join(backupRootPath, AUTO_BACKUP_FILE_NAME);
    return { programRootPath, backupRootPath, backupFilePath };
}

function getUserDataBackupPath() {
    try {
        const dbDir = path.dirname(db.name);
        return path.join(dbDir, AUTO_BACKUP_FILE_NAME);
    } catch (e) {
        return null;
    }
}

function copyBackupToUserData(sourceBackupPath) {
    try {
        const userDataBackup = getUserDataBackupPath();
        if (userDataBackup && sourceBackupPath !== userDataBackup && fs.existsSync(sourceBackupPath)) {
            fs.copyFileSync(sourceBackupPath, userDataBackup);
            console.log(`[auto-backup] Copy saved next to database: ${userDataBackup}`);
        }
    } catch (err) {
        console.error('[auto-backup] Failed to copy backup to userData:', err.message);
    }
}

function cleanupLegacyAutoBackups(backupRootPath) {
    try {
        const legacyEntries = fs.readdirSync(backupRootPath, { withFileTypes: true })
            .filter((entry) => {
                if (!entry.isFile()) return false;
                return entry.name.startsWith('accounting-auto-backup-');
            });

        for (const entry of legacyEntries) {
            const fullPath = path.join(backupRootPath, entry.name);
            try {
                fs.unlinkSync(fullPath);
                console.log(`[auto-backup] removed legacy backup file: ${entry.name}`);
            } catch (error) {
                console.error(`[auto-backup] failed to remove legacy backup ${entry.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('[auto-backup] cleanupLegacyAutoBackups error:', error.message);
    }
}

function runWalCheckpoint() {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
        console.log('[db] WAL checkpoint completed');
    } catch (error) {
        console.error('[db] WAL checkpoint failed:', error.message);
    }
}

function checkDatabaseIntegrity() {
    try {
        const result = db.pragma('integrity_check');
        const status = result && result[0] ? result[0].integrity_check : 'unknown';
        if (status === 'ok') {
            console.log('[db] Integrity check passed');
            return true;
        }
        console.error('[db] Integrity check FAILED:', status);
        return false;
    } catch (error) {
        console.error('[db] Integrity check error:', error.message);
        return false;
    }
}

function autoRestoreFromDataBackup() {
    const { backupFilePath } = getBackupPaths();
    const userDataBackup = getUserDataBackupPath();

    // Check both locations: install dir Data/ and next to the database
    let sourceBackup = null;
    if (fs.existsSync(backupFilePath)) {
        sourceBackup = backupFilePath;
    } else if (userDataBackup && fs.existsSync(userDataBackup)) {
        sourceBackup = userDataBackup;
    }

    if (!sourceBackup) {
        console.error('[db-restore] No auto-backup found in Data/ or userData to restore from');
        return false;
    }

    try {
        const dbPath = db.name;
        const corruptedBackup = dbPath + '.corrupted-' + Date.now();

        // Save the corrupted file for inspection
        db.close();
        if (fs.existsSync(dbPath)) {
            fs.renameSync(dbPath, corruptedBackup);
        }
        removeFileIfExists(`${dbPath}-shm`);
        removeFileIfExists(`${dbPath}-wal`);

        fs.copyFileSync(sourceBackup, dbPath);
        console.log(`[db-restore] Database restored from backup (${sourceBackup}). Corrupted file saved as: ${corruptedBackup}`);
        return true;
    } catch (error) {
        console.error('[db-restore] Auto-restore failed:', error.message);
        return false;
    }
}

function createStartupBackup() {
    const { backupRootPath, backupFilePath } = getBackupPaths();

    fs.mkdirSync(backupRootPath, { recursive: true });

    try {
        runWalCheckpoint();
        removeFileIfExists(`${backupFilePath}-shm`);
        removeFileIfExists(`${backupFilePath}-wal`);
        db.backup(backupFilePath)
            .then(() => {
                console.log('[auto-backup] Startup backup saved to Data/');
                copyBackupToUserData(backupFilePath);
            })
            .catch((err) => console.error('[auto-backup] Startup backup failed:', err.message));
    } catch (error) {
        console.error('[auto-backup] Startup backup error:', error.message);
    }
}

function createDataBackupBeforeQuit() {
    const { backupRootPath, backupFilePath } = getBackupPaths();

    fs.mkdirSync(backupRootPath, { recursive: true });

    runWalCheckpoint();

    removeFileIfExists(`${backupFilePath}-shm`);
    removeFileIfExists(`${backupFilePath}-wal`);

    // Use better-sqlite3's built-in .backup() for a safe, consistent database backup
    return db.backup(backupFilePath).then(() => {
        copyBackupToUserData(backupFilePath);
        return backupFilePath;
    });
}

/**
 * Run on app startup: cleanup legacy files, check DB integrity, restore or backup.
 * Returns true if the app should continue, false if it needs to relaunch.
 */
function runStartupChecks() {
    const { backupRootPath } = getBackupPaths();
    fs.mkdirSync(backupRootPath, { recursive: true });
    cleanupLegacyAutoBackups(backupRootPath);

    // Check database integrity on startup
    const dbHealthy = checkDatabaseIntegrity();
    if (!dbHealthy) {
        console.error('[startup] Database corruption detected! Attempting auto-restore...');
        const restored = autoRestoreFromDataBackup();
        if (restored) {
            dialog.showErrorBox(
                'تم استعادة البيانات',
                'تم اكتشاف مشكلة في قاعدة البيانات وتمت الاستعادة التلقائية من آخر نسخة احتياطية.\nسيتم إعادة تشغيل البرنامج الآن.'
            );
            return false; // Needs relaunch
        } else {
            dialog.showErrorBox(
                'خطأ في قاعدة البيانات',
                'تم اكتشاف مشكلة في قاعدة البيانات ولم يتم العثور على نسخة احتياطية للاستعادة.\nيرجى استخدام أداة الاستعادة (restore.cmd) يدوياً.'
            );
        }
    } else {
        // Database is healthy — create a startup backup
        createStartupBackup();
    }

    return true; // Continue normally
}

/**
 * Handle the before-quit backup. Returns a Promise.
 * Used by main.js in the 'before-quit' event.
 */
function handleQuitBackup() {
    return createDataBackupBeforeQuit();
}

/**
 * Fallback: raw file copy when db.backup() fails during quit.
 */
function handleQuitBackupFallback() {
    try {
        const { backupRootPath, backupFilePath } = getBackupPaths();
        fs.mkdirSync(backupRootPath, { recursive: true });
        const dbPath = db && db.name ? db.name : null;

        removeFileIfExists(`${backupFilePath}-shm`);
        removeFileIfExists(`${backupFilePath}-wal`);

        if (dbPath && fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupFilePath);
            console.log(`[auto-backup] Fallback copy succeeded: ${backupFilePath}`);
            copyBackupToUserData(backupFilePath);
        } else {
            console.error('[auto-backup] Could not locate database file for fallback copy');
        }
    } catch (fallbackErr) {
        console.error('[auto-backup] Fallback copy also failed:', fallbackErr.message);
    }
}

module.exports = {
    runStartupChecks,
    handleQuitBackup,
    handleQuitBackupFallback
};
