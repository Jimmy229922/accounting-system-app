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

let authSessionToken = null;
let isQuitBackupRunning = false;
let isQuitBackupCompleted = false;

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
