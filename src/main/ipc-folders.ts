

import { ipcMain } from 'electron'
import * as db     from '../db/db'

export function registerFolderHandlers(): void {

  /**
   * Returns all folders with entry counts.
   */
  ipcMain.handle('folders:getAll', async () => {
    return db.getAllFolders()
  })

  /**
   * Creates a new folder.
   * @param name  Display name (must be unique)
   * @returns     { id: number }
   * @throws      if name already exists
   */
  ipcMain.handle('folders:create', async (_event, name: string, color = '#7c6dd8') => {
    const id = db.createFolder({ name, color })
    return { id }
  })

  /**
   * Renames a folder.
   * @param id    Folder ID
   * @param name  New name
   * @returns     { success: boolean }
   */
  ipcMain.handle('folders:update', async (_event, id: number, name: string, color = '#7c6dd8') => {
    const success = db.updateFolder({ id, name, color })
    return { success }
  })

  /**
   * Deletes a folder and all its entries (CASCADE).
   * @param id  Folder ID
   * @returns   { success: boolean }
   */
  ipcMain.handle('folders:delete', async (_event, id: number) => {
    const success = db.deleteFolder(id)
    return { success }
  })
}