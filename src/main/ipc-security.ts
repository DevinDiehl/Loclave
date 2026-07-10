import { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { isUnlocked } from '../cryptography/session'

export function requireTrustedRenderer(event: IpcMainInvokeEvent): void {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || window.webContents !== event.sender || event.senderFrame?.url !== window.webContents.getURL()) {
        throw new Error('Untrusted IPC sender')
    }
}

export function requireUnlocked(event: IpcMainInvokeEvent): void {
    requireTrustedRenderer(event)
    if (!isUnlocked()) throw new Error('Session is locked')
}
