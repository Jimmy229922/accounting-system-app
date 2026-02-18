const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { INVITE_CODE } = require('./inviteConfig');

// Handle uncaught exceptions to show errors when running from executable
process.on('uncaughtException', (error) => {
    dialog.showErrorBox('Error', `An unexpected error occurred:\n${error.message}`);
    console.error(error);
});

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

let mainWindow;
let inviteWindow;
let authWindow;
let authSessionToken = null;
let inviteUnlocked = false;
let authUnlocked = false;
let isQuitBackupRunning = false;
let isQuitBackupCompleted = false;

const AUTO_BACKUP_FOLDER_NAME = 'PIC';
const MAX_AUTO_BACKUPS = 5;

function getProgramRootPath() {
    if (app.isPackaged) {
        return path.dirname(process.execPath);
    }
    return path.resolve(__dirname, '../../..');
}

function pruneOldAutoBackups(backupRootPath) {
    try {
        const entries = fs.readdirSync(backupRootPath, { withFileTypes: true })
            .filter(e => e.isFile() && e.name.startsWith('accounting-auto-backup-') && e.name.endsWith('.db'))
            .map(e => ({ name: e.name, full: path.join(backupRootPath, e.name) }))
            .sort((a, b) => b.name.localeCompare(a.name)); // newest first

        if (entries.length > MAX_AUTO_BACKUPS) {
            for (let i = MAX_AUTO_BACKUPS; i < entries.length; i++) {
                try {
                    fs.unlinkSync(entries[i].full);
                    console.log(`[auto-backup] pruned old backup: ${entries[i].name}`);
                } catch (e) {
                    console.error(`[auto-backup] failed to prune ${entries[i].name}:`, e.message);
                }
            }
        }
    } catch (e) {
        console.error('[auto-backup] pruneOldAutoBackups error:', e.message);
    }
}

function createDataBackupBeforeQuit() {
    const programRootPath = getProgramRootPath();
    const backupRootPath = path.join(programRootPath, AUTO_BACKUP_FOLDER_NAME);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `accounting-auto-backup-${timestamp}.db`;
    const backupFilePath = path.join(backupRootPath, backupFileName);

    fs.mkdirSync(backupRootPath, { recursive: true });

    // Use better-sqlite3's built-in .backup() for a safe, consistent database backup
    db.backup(backupFilePath);

    // Clean up old backups, keep only the latest MAX_AUTO_BACKUPS
    pruneOldAutoBackups(backupRootPath);

    return backupFilePath;
}

function isInviteValid() {
    try {
        const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('invite_code', 'invite_expiry')").all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });

        const expiry = map.invite_expiry ? new Date(map.invite_expiry) : null;
        const validExpiry = expiry ? expiry > new Date() : false;
        // Consider any stored, non-expired invite as valid even if code changes later
        if (validExpiry) return true;

        // Fallback: if expiry missing, enforce match
        const codeMatches = map.invite_code === INVITE_CODE;
        return codeMatches && validExpiry;
    } catch (err) {
        console.error('[invite] validation error:', err);
        return false;
    }
}

function showInviteWindow() {
    return new Promise((resolve) => {
        if (inviteWindow) {
            inviteWindow.focus();
            return;
        }

        inviteWindow = new BrowserWindow({
            width: 420,
            height: 360,
            resizable: false,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const invitePath = path.join(__dirname, '../renderer/views/invite/index.html');
        inviteWindow.loadFile(invitePath).catch(e => {
            console.error('Failed to load invite view:', e);
            dialog.showErrorBox('Load Error', `Failed to load invite view:\n${invitePath}\n${e.message}`);
        });

        const cleanup = () => {
            ipcMain.removeListener('invite-unlocked', onUnlocked);
            if (inviteWindow) {
                inviteWindow.close();
                inviteWindow = null;
            }
        };

        const onUnlocked = () => {
            inviteUnlocked = true;
            cleanup();
            resolve();
        };

        ipcMain.once('invite-unlocked', onUnlocked);

        inviteWindow.on('closed', () => {
            inviteWindow = null;
            // If user closes the invite window without unlocking, exit to prevent bypassing
            if (!mainWindow && !inviteUnlocked) {
                app.quit();
            }
        });
    });
}

function showAuthWindow() {
    return new Promise((resolve) => {
        if (authWindow) {
            authWindow.focus();
            return;
        }

        authWindow = new BrowserWindow({
            width: 440,
            height: 420,
            resizable: false,
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        const authPath = path.join(__dirname, '../renderer/views/auth/index.html');
        authWindow.loadFile(authPath).catch((error) => {
            console.error('Failed to load auth view:', error);
            dialog.showErrorBox('Load Error', `Failed to load auth view:\n${authPath}\n${error.message}`);
        });

        const cleanup = () => {
            ipcMain.removeListener('auth-unlocked', onUnlocked);
            if (authWindow) {
                authWindow.close();
                authWindow = null;
            }
        };

        const onUnlocked = () => {
            authUnlocked = true;
            cleanup();
            resolve();
        };

        ipcMain.once('auth-unlocked', onUnlocked);

        authWindow.on('closed', () => {
            authWindow = null;
            // If user closes auth window without login, exit to prevent bypassing.
            if (!mainWindow && !authUnlocked) {
                app.quit();
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        backgroundColor: '#0b1220', // Dark theme background to prevent white flash
        autoHideMenuBar: true, // Hide the default menu bar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Remove the application menu completely
    mainWindow.setMenuBarVisibility(false);

    // Load the dashboard as the starting page
    const viewPath = path.join(__dirname, '../renderer/views/dashboard/index.html');
    mainWindow.loadFile(viewPath).catch(e => {
        console.error('Failed to load view:', e);
        dialog.showErrorBox('Load Error', `Failed to load view:\n${viewPath}\n${e.message}`);
    });

    mainWindow.once('ready-to-show', () => {
        if (!mainWindow) return;
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
    });

    // Open the DevTools (optional, helpful for development)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.on('auth-session-token', (event, token) => {
    authSessionToken = typeof token === 'string' ? token : null;
});

ipcMain.handle('get-auth-session-token', () => {
    return authSessionToken;
});

app.whenReady().then(() => {
    const autoBackupRootPath = path.join(getProgramRootPath(), AUTO_BACKUP_FOLDER_NAME);
    fs.mkdirSync(autoBackupRootPath, { recursive: true });

    const openAppFlow = async () => {
        authSessionToken = null;
        inviteUnlocked = false;
        authUnlocked = false;
        const valid = isInviteValid();
        if (!valid) {
            await showInviteWindow();
        }
        await showAuthWindow();
        if (!mainWindow) {
            createWindow();
        }
    };

    openAppFlow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            openAppFlow();
        }
    });
});

app.on('before-quit', (event) => {
    if (isQuitBackupCompleted || isQuitBackupRunning) {
        return;
    }

    event.preventDefault();
    isQuitBackupRunning = true;

    try {
        const backupPath = createDataBackupBeforeQuit();
        console.log(`[auto-backup] Database backup created at: ${backupPath}`);
        isQuitBackupCompleted = true;
        app.quit();
    } catch (error) {
        isQuitBackupRunning = false;
        console.error('[auto-backup] failed to create database backup before quit:', error);

        // Attempt a fallback copy of the raw database file
        try {
            const programRootPath = getProgramRootPath();
            const backupRootPath = path.join(programRootPath, AUTO_BACKUP_FOLDER_NAME);
            fs.mkdirSync(backupRootPath, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fallbackPath = path.join(backupRootPath, `accounting-auto-backup-${timestamp}.db`);
            const dbPath = db && db.name ? db.name : null;
            if (dbPath && fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, fallbackPath);
                console.log(`[auto-backup] Fallback copy succeeded: ${fallbackPath}`);
                pruneOldAutoBackups(backupRootPath);
            } else {
                console.error('[auto-backup] Could not locate database file for fallback copy');
            }
        } catch (fallbackErr) {
            console.error('[auto-backup] Fallback copy also failed:', fallbackErr.message);
        }

        // Never block the user from closing the app
        isQuitBackupCompleted = true;
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
