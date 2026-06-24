import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import * as db from '../db/db'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 640,
        minWidth: 700,
        minHeight: 500,
        show: false,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0d0d12',
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => mainWindow?.show())

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })

    if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    registerIpcHandlers(mainWindow)
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.yourapp.password-keep')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    db.init()

    const launchOnStartup = db.getSetting('startOnLogin')
    app.setLoginItemSettings({
        openAtLogin: launchOnStartup === 'true',
        openAsHidden: false
    })

    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
    db.close()
})
