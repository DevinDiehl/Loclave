import { ipcMain, clipboard }  from 'electron'
import * as db      from '../db/db'
import { getSessionKey }           from '../cryptography/session'
import { encryptToString, decryptFromString } from '../cryptography/crypto'
import https from 'https'
import http from 'http'
export function registerEntryHandlers(): void {

  let clipboardTimeout: NodeJS.Timeout | null = null;

  /**
   * Returns all entries across all folders.
   */
  ipcMain.handle('entries:getAll', async () => {
    return db.getEntriesByFolder === undefined ? [] : (() => {
      const folders = db.getAllFolders()
      return folders.flatMap(f => db.getEntriesByFolder(f.id))
    })()
  })

  /**
   * Returns all entries in a specific folder.
   */
  ipcMain.handle('entries:getByFolder', async (_event, folderId: number) => {
    return db.getEntriesByFolder(folderId)
  })

  /**
   * Full-text search across title, username, url, notes.
   */
  ipcMain.handle('entries:search', async (_event, query: string) => {
    return db.searchEntries(query)
  })

  /**
   * Creates a new entry. Password must already be encrypted (from renderer).
   */
  ipcMain.handle('entries:create', async (_event, input: {
    folderId: number
    title:    string
    username: string
    password: string
    url:      string | null
    notes:    string | null
  }) => {
    const id = db.createEntry({ ...input, favorite: 0 })
    return { id }
  })

  /**
   * Updates an existing entry.
   */
  ipcMain.handle('entries:update', async (_event, input: {
    id:       number
    folderId: number
    title:    string
    username: string
    password: string
    url:      string | null
    notes:    string | null
    favorite: 0 | 1
  }) => {
    const success = db.updateEntry(input)
    return { success }
  })

  /**
   * Deletes an entry by ID.
   */
  ipcMain.handle('entries:delete', async (_event, id: number) => {
    const success = db.deleteEntry(id)
    return { success }
  })

  /**
   * Toggles the favorite flag on an entry.
   */
  ipcMain.handle('entries:toggleFavorite', async (_event, id: number) => {
    const success = db.toggleFavorite(id)
    return { success }
  })

  /**
   * Encrypts a plain-text password using the current session key.
   * Called from the renderer before saving an entry.
   * Returns the JSON string to store in the db.
   */
  ipcMain.handle('entries:encryptPassword', async (_event, plaintext: string) => {
    const key = getSessionKey()
    if (!key) throw new Error('Session is locked')
    return encryptToString(plaintext, key)
  })

  /**
   * Decrypts a stored password JSON string using the current session key.
   * Called from the renderer when showing or copying a password.
   */
  ipcMain.handle('entries:decryptPassword', async (_event, stored: string) => {
    const key = getSessionKey()
    if (!key) throw new Error('Session is locked')
    return decryptFromString(stored, key)
  })

  ipcMain.handle('entries:copyWithTimeout' , async (_event, password:string) => {
    try {
      await clipboard.writeText(password);
      if (clipboardTimeout) {
        clearTimeout(clipboardTimeout)
      }
        
      clipboardTimeout = setTimeout(async () => {
        const current = await clipboard.readText();

        if ( current === password) {
          await clipboard.writeText('');
        }
      }, parseInt(db.getSetting('clipboardTimeout') || '30000'));

    } catch (error){
      console.error('Failed to copy password', error);
    }
  })

  /**
   * Fetches a favicon for a domain and returns it as a data URI.
   * Uses DuckDuckGo's favicon service.
   */
  ipcMain.handle('entries:fetchFavicon', async (_event, domain: string) => {
    try {
      const faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
      
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        https.get(faviconUrl, { timeout: 5000 }, (response) => {
          const chunks: Buffer[] = []
          
          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
          })
          
          response.on('end', () => {
            resolve(Buffer.concat(chunks))
          })
          
          response.on('error', reject)
        }).on('error', reject)
      })

      // Convert to data URI
      const base64 = buffer.toString('base64')
      const dataUri = `data:image/x-icon;base64,${base64}`
      
      return { dataUri }
    } catch (error) {
      console.error(`Failed to fetch favicon for ${domain}:`, error)
      return { dataUri: null }
    }
  })

}