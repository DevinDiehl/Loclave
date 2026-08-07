import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import * as db from '../db/db'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

const SUPPORT_URL = 'https://www.google.com'

function createApplicationMenu(): void {
    const isMac = process.platform === 'darwin'
    const openSupportPage = (): void => {
        void shell.openExternal(SUPPORT_URL)
    }

    const template: MenuItemConstructorOptions[] = [
        ...(isMac
            ? [
                  {
                      label: app.name,
                      submenu: [
                          { role: 'about' as const },
                          { type: 'separator' as const },
                          { role: 'services' as const },
                          { type: 'separator' as const },
                          { role: 'hide' as const },
                          { role: 'hideOthers' as const },
                          { role: 'unhide' as const },
                          { type: 'separator' as const },
                          { role: 'quit' as const }
                      ]
                  }
              ]
            : []),
        {
            label: 'File',
            submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Report a Bug',
                    click: openSupportPage
                },
                {
                    label: 'Feedback',
                    click: openSupportPage
                }
            ]
        }
    ]

    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function getAppIconPath(): string {
    return app.isPackaged
        ? join(process.resourcesPath, 'icon.png')
        : join(__dirname, '../../resources/icon.png')
}

function createWindow(): void {
    const iconPath = getAppIconPath()

    mainWindow = new BrowserWindow({
        width: 900,
        height: 640,
        minWidth: 700,
        minHeight: 500,
        show: false,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0d0d12',
        icon: iconPath,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    })

    mainWindow.setIcon(iconPath)

    mainWindow.on('ready-to-show', () => mainWindow?.show())

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsed = new URL(url)
            if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
                return { action: 'deny' }
            void shell.openExternal(parsed.toString())
        } catch {
            return { action: 'deny' }
        }
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
    electronApp.setAppUserModelId('com.devindiehl.loclave')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    db.init()

    const launchOnStartup = db.getSetting('startOnLogin')
    const minimizeToTray = db.getSetting('minimizeToTray')
    app.setLoginItemSettings({
        openAtLogin: launchOnStartup === 'true',
        openAsHidden: minimizeToTray === 'true'
    })

    createApplicationMenu()
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
