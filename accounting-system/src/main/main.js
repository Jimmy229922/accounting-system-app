const { app, BrowserWindow, dialog, ipcMain } = require('electron');
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
            cleanup();
            resolve();
        };

        ipcMain.once('invite-unlocked', onUnlocked);

        inviteWindow.on('closed', () => {
            inviteWindow = null;
            // If user closes the invite window without unlocking, exit to prevent bypassing
            if (!mainWindow) {
                app.quit();
            }
        });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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

    // Open the DevTools (optional, helpful for development)
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    const openAppFlow = async () => {
        const valid = isInviteValid();
        if (!valid) {
            await showInviteWindow();
        }
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});