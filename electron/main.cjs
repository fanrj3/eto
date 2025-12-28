const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Suppress security warnings for this local-only app
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        fullscreen: true, // Default to fullscreen
        backgroundColor: '#000000', // Prevent white flash
        show: false, // Don't show until ready
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simple game ports, this is often easier, though less secure for web content
            webSecurity: false, // Sometimes needed for local file loading issues in some environments
            sandbox: false // Explicitly disable sandbox to avoid conflicts with nodeIntegration
        },
        autoHideMenuBar: true
    });

    // Check if we are in development mode
    const isDev = !app.isPackaged;

    if (isDev) {
        // In development, load the Vite dev server
        win.loadURL('http://localhost:5173').catch(e => console.error('Failed to load URL:', e));
    } else {
        // In production, load the index.html from the dist folder
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.once('ready-to-show', () => {
        win.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
