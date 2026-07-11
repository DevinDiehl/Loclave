import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'fs/promises'
import * as db from '../db/db'
import { requireUnlocked } from './ipc-security'
import { getSessionKey } from '../cryptography/session'
import { decryptFromString } from '../cryptography/crypto'

export function registerFolderHandlers(mainWindow: BrowserWindow): void {
    /**
     * Returns all folders with entry counts.
     */
    ipcMain.handle('folders:getAll', async (event) => {
        requireUnlocked(event)
        return db.getAllFolders()
    })

    /**
     * Creates a new folder.
     * @param name  Display name (must be unique)
     * @returns     { id: number }
     * @throws      if name already exists
     */
    ipcMain.handle(
        'folders:create',
        async (event, name: string, color = '#7c6dd8', sortOrder = 0) => {
            requireUnlocked(event)
            const id = db.createFolder({ name, color, sort_order: sortOrder })
            return { id }
        }
    )

    /**
     * Renames a folder.
     * @param id    Folder ID
     * @param name  New name
     * @returns     { success: boolean }
     */
    ipcMain.handle(
        'folders:update',
        async (event, id: number, name: string, color = '#7c6dd8', sortOrder = 0) => {
            requireUnlocked(event)
            const success = db.updateFolder({ id, name, color, sort_order: sortOrder })
            return { success }
        }
    )

    /**
     * Deletes a folder and all its entries (CASCADE).
     * @param id  Folder ID
     * @returns   { success: boolean }
     */
    ipcMain.handle('folders:delete', async (event, id: number) => {
        requireUnlocked(event)
        const success = db.deleteFolder(id)
        return { success }
    })

    ipcMain.handle('folders:exportPdf', async (event, folderId: number) => {
        requireUnlocked(event)
        if (!Number.isSafeInteger(folderId) || folderId < 1) throw new Error('Invalid folder')

        const folder = db.getAllFolders().find((item) => item.id === folderId)
        if (!folder) throw new Error('Folder not found')

        const key = getSessionKey()
        if (!key) throw new Error('Session is locked')

        const entries = db.getEntriesByFolder(folderId).map((entry) => {
            let password: string
            try { password = decryptFromString(entry.password, key, `entry:${entry.id}`) }
            catch { password = decryptFromString(entry.password, key) }
            return { ...entry, password }
        })

        const result = await dialog.showSaveDialog(mainWindow, {
            title: `Export ${folder.name} as PDF`,
            defaultPath: `${safeFileName(folder.name)}.pdf`,
            filters: [{ name: 'PDF document', extensions: ['pdf'] }]
        })
        if (result.canceled || !result.filePath) return { success: false, canceled: true }

        const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
        try {
            const html = buildFolderPdfHtml(folder.name, entries)
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
            const pdf = await printWindow.webContents.printToPDF({
                pageSize: 'A4',
                printBackground: true,
                margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
            })
            await writeFile(result.filePath, pdf)
            return { success: true, canceled: false, filePath: result.filePath }
        } finally {
            if (!printWindow.isDestroyed()) printWindow.destroy()
        }
    })
}

function safeFileName(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '-').trim() || 'folder'
}

function escapeHtml(value: string | null | undefined): string {
    return String(value ?? '')
        .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

export function buildFolderPdfHtml(folderName: string, entries: Array<{ title: string; username: string | null; password: string; url: string | null; notes: string | null }>): string {
    const cards = entries.length === 0
        ? '<p class="empty">This folder contains no entries.</p>'
        : entries.map((entry) => `<section class="entry">
            <h2>${escapeHtml(entry.title)}</h2>
            <dl>
                <dt>Username</dt><dd>${escapeHtml(entry.username) || '&mdash;'}</dd>
                <dt>Password</dt><dd class="secret">${escapeHtml(entry.password)}</dd>
                <dt>Website</dt><dd>${escapeHtml(entry.url) || '&mdash;'}</dd>
                ${entry.notes ? `<dt>Notes</dt><dd class="notes">${escapeHtml(entry.notes)}</dd>` : ''}
            </dl>
        </section>`).join('')

    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(folderName)}</title><style>
        @page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
        body { margin: 0; color: #172033; font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        header { border-bottom: 3px solid #7c6dd8; margin-bottom: 18px; padding-bottom: 12px; }
        h1 { font-size: 25px; margin: 0 0 5px; } header p { color: #667085; margin: 0; }
        .entry { border: 1px solid #d8dce5; border-radius: 8px; break-inside: avoid; margin: 0 0 12px; padding: 14px 16px; }
        h2 { color: #4f429b; font-size: 16px; margin: 0 0 10px; }
        dl { display: grid; grid-template-columns: 82px 1fr; gap: 6px 12px; margin: 0; }
        dt { color: #667085; font-weight: 600; } dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
        .secret { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; } .notes { line-height: 1.45; }
        .empty { color: #667085; font-style: italic; }
        footer { color: #8a91a2; font-size: 9px; margin-top: 18px; }
    </style></head><body><header><h1>${escapeHtml(folderName)}</h1><p>${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} exported from Lockstep</p></header>${cards}<footer>Contains sensitive information. Store this document securely.</footer></body></html>`
}
