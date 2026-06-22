const { ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { getMainWindow } = require('../windowManager');

// Enable logging
autoUpdater.logger = console;
autoUpdater.autoDownload = true; // Automatically download the update if found

function sendToRenderer(channel, ...args) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
    }
}

function register() {
    // 1. Listen for checking-for-update
    autoUpdater.on('checking-for-update', () => {
        sendToRenderer('update-message', 'checking');
    });

    // 2. Listen for update-available
    autoUpdater.on('update-available', (info) => {
        sendToRenderer('update-message', 'available', info);
    });

    // 3. Listen for update-not-available
    autoUpdater.on('update-not-available', (info) => {
        sendToRenderer('update-message', 'not-available', info);
    });

    // 4. Listen for error
    autoUpdater.on('error', (err) => {
        sendToRenderer('update-message', 'error', err == null ? 'Unknown error' : (err.stack || err).toString());
    });

    // 5. Listen for download-progress
    autoUpdater.on('download-progress', (progressObj) => {
        sendToRenderer('update-download-progress', progressObj);
    });

    // 6. Listen for update-downloaded
    autoUpdater.on('update-downloaded', async (info) => {
        sendToRenderer('update-message', 'downloaded', info);
        try {
            console.log('[auto-updater] Update downloaded. Initiating database backup before installation...');
            const { handleQuitBackup } = require('../autoBackup');
            if (typeof handleQuitBackup === 'function') {
                const backupPath = await handleQuitBackup();
                console.log(`[auto-updater] Safety backup created successfully at: ${backupPath}`);
            }
        } catch (backupError) {
            console.error('[auto-updater] Safety backup failed before update installation:', backupError);
        }
        
        // Finalize install and restart
        autoUpdater.quitAndInstall();
    });

    // --- IPC Handlers ---
    ipcMain.handle('check-for-updates', async () => {
        try {
            // Checks for updates and downloads them if available
            const result = await autoUpdater.checkForUpdates();
            return { success: true, updateInfo: result ? result.updateInfo : null };
        } catch (error) {
            console.error('[auto-updater] Check for updates failed:', error);
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
