const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Handle uncaught exceptions to show errors when running from executable
process.on('uncaughtException', (error) => {
    try { if (db) db.close(); } catch (_) {}
    dialog.showErrorBox('Error', `An unexpected error occurred:\n${error.message}`);
    console.error(error);
});

// Prevent running multiple instances simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

if (app.isPackaged && process.env.ACC_SYSTEM_USE_DEFAULT_USERDATA !== '1') {
    try {
        const { shell } = require('electron');
        const configuredRoot = (process.env.ACCOUNTING_SYSTEM_ROOT || '').trim();
        const preferredPortableRoot = path.join(app.getPath('desktop'), 'APP_JS');
        let programRoot = configuredRoot;

        if (programRoot) {
            const normalizedConfiguredRoot = path.normalize(programRoot);
            if (path.basename(normalizedConfiguredRoot).toLowerCase() === 'app_js') {
                programRoot = path.join(normalizedConfiguredRoot, 'برنامج الحسابات');
            }
        }
        
        if (!programRoot) {
            programRoot = path.join(preferredPortableRoot, 'برنامج الحسابات');
        }

        if (!fs.existsSync(programRoot)) {
            fs.mkdirSync(programRoot, { recursive: true });
        }

        const shortcutPath = path.join(programRoot, 'تشغيل نظام الحسابات.lnk');
        shell.writeShortcutLink(shortcutPath, 'create', {
            target: process.execPath,
            icon: process.execPath,
            iconIndex: 0,
            description: 'تشغيل النظام'
        });

        const desktopShortcutPath = path.join(app.getPath('desktop'), 'تشغيل نظام الحسابات.lnk');
        shell.writeShortcutLink(desktopShortcutPath, 'create', {
            target: process.execPath,
            icon: process.execPath,
            iconIndex: 0,
            description: 'تشغيل النظام'
        });

        const portableUserDataPath = path.join(programRoot, 'DATA', 'userData');
        fs.mkdirSync(portableUserDataPath, { recursive: true });
        app.setPath('userData', portableUserDataPath);
        
        const picFolder = path.join(programRoot, 'PIC');
        fs.mkdirSync(picFolder, { recursive: true });

        // Clean up installer files after a small delay to ensure NSIS releases the lock
        setTimeout(() => {
            const cleanDir = (dir, depth = 0) => {
                // limit depth to avoid long scans
                if (depth > 2) return; 
                try {
                    if (!fs.existsSync(dir)) return;
                    const items = fs.readdirSync(dir, { withFileTypes: true });
                    for (const item of items) {
                        if (item.isDirectory()) {
                            // skip large or system folders
                            if (!['AppData', 'Windows', 'Program Files', 'Program Files (x86)', 'node_modules'].includes(item.name)) {
                                cleanDir(path.join(dir, item.name), depth + 1);
                            }
                        } else if (item.isFile()) {
                            const name = item.name.toLowerCase();
                            if (name.startsWith('accounting system setup') && name.endsWith('.exe')) {
                                try {
                                    fs.unlinkSync(path.join(dir, item.name));
                                    console.log('Deleted installer:', path.join(dir, item.name));
                                } catch(e) {}
                            }
                        }
                    }
                } catch(e) {}
            };
            cleanDir(app.getPath('downloads'));
            cleanDir(app.getPath('desktop'));
        }, 5000);

    } catch (error) {
        console.error('[startup] failed to set portable userData path:', error.message);
    }
}

let initDB, setupIPC, db;

try {
    // Load modules inside try-catch to handle initialization errors
    ({ initDB, db } = require('./db'));
    ({ setupIPC } = require('./ipcHandlers'));

    // Initialize Database
    initDB();

    // Setup IPC Handlers
    setupIPC();
} catch (error) {
    dialog.showErrorBox('Startup Error', `Failed to initialize application:\n${error.message}`);
    process.exit(1);
}

const { runStartupChecks, handleQuitBackup, handleQuitBackupFallback } = require('./autoBackup');
const { openAppFlow, getMainWindow } = require('./windowManager');
const { INVITE_CODE, INVITE_DURATION_DAYS } = require('./inviteConfig');

let authSessionToken = null;
let isQuitBackupRunning = false;
let isQuitBackupCompleted = false;

function getInviteSettingsMap() {
    const rows = db.prepare(
        "SELECT key, value FROM settings WHERE key IN ('invite_code', 'invite_expiry')"
    ).all();
    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });
    return map;
}

function activateInviteForDays(days) {
    const parsedDays = Number(days);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
        return { success: false, error: 'Invalid activation days' };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parsedDays);
    const expiresAtIso = expiresAt.toISOString();

    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
        const tx = db.transaction(() => {
            stmt.run({ key: 'invite_code', value: INVITE_CODE });
            stmt.run({ key: 'invite_expiry', value: expiresAtIso });
        });
        tx();
        return { success: true, expiresAt: expiresAtIso };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function ensureAutoActivationForFreshInstall() {
    try {
        // Upgrade legacy trial codes to V2
        const legacyCodes = ['INV-2026-R3-K9N4Q7W2-61ZT-MPL8-HSX5-7440', 'INV-2026-AX9F3Q7M-48ZP-CKD1-PLN7-TS9X-9931'];
        
        let inviteSettings = getInviteSettingsMap();
        if (legacyCodes.includes(inviteSettings.invite_code)) {
            // Delete the old static code so they get a fresh 15-day trial on the new system
            db.prepare("DELETE FROM settings WHERE key IN ('invite_code', 'invite_expiry', 'renew_count')").run();
            inviteSettings = {}; // force re-activation
        }

        const hasInviteCode = Boolean(inviteSettings.invite_code);
        if (hasInviteCode) {
            return false;
        }

        const result = activateInviteForDays(INVITE_DURATION_DAYS);
        if (result.success) {
            console.log(`[invite] auto-activated for ${INVITE_DURATION_DAYS} days until ${result.expiresAt}`);
            // Also set initial renew count for V2
            try {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)')
                  .run({ key: 'renew_count', value: '0' });
            } catch (e) {
                console.error('Failed to set initial renew_count', e);
            }
            return true;
        }

        console.error('[invite] auto-activation failed:', result.error);
        return false;
    } catch (error) {
        console.error('[invite] auto-activation error:', error.message);
        return false;
    }
}

function getCliActivationDays() {
    const args = process.argv.slice(1);

    if (args.includes('--activate-30-days')) {
        return 30;
    }

    const daysArg = args.find((arg) => arg.startsWith('--activate-days='));
    if (!daysArg) {
        return null;
    }

    const [, value] = daysArg.split('=');
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
}

function handleCliActivationMode() {
    const days = getCliActivationDays();
    if (!days) {
        return false;
    }

    const result = activateInviteForDays(days);
    if (!result.success) {
        dialog.showErrorBox('Activation Error', `Failed to activate invite period:\n${result.error}`);
        app.exit(1);
        return true;
    }

    console.log(`[invite] activated for ${days} days until ${result.expiresAt}`);
    app.exit(0);
    return true;
}

ipcMain.on('auth-session-token', (event, token) => {
    authSessionToken = typeof token === 'string' ? token : null;
});

ipcMain.handle('get-auth-session-token', () => {
    return authSessionToken;
});

// Focus existing window when a second instance tries to launch
app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
    }
});

app.whenReady().then(() => {
    if (!gotTheLock) return;

    // Run DB integrity check + startup backup
    const shouldContinue = runStartupChecks();
    if (!shouldContinue) {
        app.relaunch();
        app.quit();
        return;
    }

    if (handleCliActivationMode()) {
        return;
    }

    ensureAutoActivationForFreshInstall();

    openAppFlow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            openAppFlow();
        }
    });
});

app.on('before-quit', (event) => {
    if (!gotTheLock) return;
    if (isQuitBackupCompleted || isQuitBackupRunning) {
        return;
    }

    event.preventDefault();
    isQuitBackupRunning = true;

    handleQuitBackup()
        .then((backupPath) => {
            console.log(`[auto-backup] Database backup updated at: ${backupPath}`);
            isQuitBackupCompleted = true;
            app.quit();
        })
        .catch((error) => {
            isQuitBackupRunning = false;
            console.error('[auto-backup] failed to create database backup before quit:', error);

            handleQuitBackupFallback();

            // Never block the user from closing the app
            isQuitBackupCompleted = true;
            app.quit();
        });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
