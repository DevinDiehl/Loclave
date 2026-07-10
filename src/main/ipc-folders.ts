import { ipcMain } from 'electron'
import * as db from '../db/db'
import { requireUnlocked } from './ipc-security'

export function registerFolderHandlers(): void {
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
}
