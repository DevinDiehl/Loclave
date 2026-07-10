import { ipcMain, clipboard } from 'electron'
import { createHash } from 'crypto'
import * as db from '../db/db'
import { getSessionKey } from '../cryptography/session'
import { encryptToString, decryptFromString } from '../cryptography/crypto'
import https from 'https'
import { requireUnlocked } from './ipc-security'
async function checkPasswordBreach(password: string): Promise<{ count: number }> {
    const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const response = await new Promise<string>((resolve, reject) => {
        const req = https.get(
            `https://api.pwnedpasswords.com/range/${prefix}`,
            {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Password-Keep/1.0'
                }
            },
            (res) => {
                let body = ''
                res.setEncoding('utf8')
                res.on('data', (chunk) => {
                    body += chunk
                })
                res.on('end', () => resolve(body))
            }
        )

        req.on('error', reject)
        req.on('timeout', () => req.destroy(new Error('pwned-passwords-timeout')))
    })

    const match = response.split(/\r?\n/).find((line) => line.split(':')[0] === suffix)

    if (!match) return { count: 0 }

    const countValue = Number(match.split(':')[1] || '0')
    return { count: Number.isFinite(countValue) ? countValue : 0 }
}

export function registerEntryHandlers(): void {
    let clipboardTimeout: NodeJS.Timeout | null = null

    /**
     * Returns all entries across all folders.
     */
    ipcMain.handle('entries:getAll', async (event) => {
        requireUnlocked(event)
        return db.getEntriesByFolder === undefined
            ? []
            : (() => {
                  const folders = db.getAllFolders()
                  return folders.flatMap((f) => db.getEntriesByFolder(f.id))
              })()
    })

    /**
     * Returns all entries in a specific folder.
     */
    ipcMain.handle('entries:getByFolder', async (event, folderId: number) => {
        requireUnlocked(event)
        return db.getEntriesByFolder(folderId)
    })

    /**
     * Full-text search across title, username, url, notes.
     */
    ipcMain.handle('entries:search', async (event, query: string) => {
        requireUnlocked(event)
        return db.searchEntries(query)
    })

    /**
     * Creates a new entry. Password must already be encrypted (from renderer).
     */
    ipcMain.handle(
        'entries:create',
        async (
            event,
            input: {
                folderId: number
                title: string
                username: string
                password: string
                url: string | null
                notes: string | null
            }
        ) => {
            requireUnlocked(event)
            const key = getSessionKey()
            if (!key) throw new Error('Session is locked')
            const id = db.createEntry({ ...input, password: '', favorite: 0 })
            const encryptedPassword = encryptToString(input.password, key, `entry:${id}`)
            db.updateEntry({ ...input, id, password: encryptedPassword, favorite: 0 })
            return { id }
        }
    )

    /**
     * Updates an existing entry.
     */
    ipcMain.handle(
        'entries:update',
        async (
            event,
            input: {
                id: number
                folderId: number
                title: string
                username: string
                password: string
                url: string | null
                notes: string | null
                favorite: 0 | 1
            }
        ) => {
            requireUnlocked(event)
            const key = getSessionKey()
            if (!key) throw new Error('Session is locked')
            const encryptedPassword = encryptToString(input.password, key, `entry:${input.id}`)
            const success = db.updateEntry({ ...input, password: encryptedPassword })
            return { success }
        }
    )

    /**
     * Deletes an entry by ID.
     */
    ipcMain.handle('entries:delete', async (event, id: number) => {
        requireUnlocked(event)
        const success = db.deleteEntry(id)
        return { success }
    })

    /**
     * Toggles the favorite flag on an entry.
     */
    ipcMain.handle('entries:toggleFavorite', async (event, id: number) => {
        requireUnlocked(event)
        const success = db.toggleFavorite(id)
        return { success }
    })

    /**
     * Encrypts a plain-text password using the current session key.
     * Called from the renderer before saving an entry.
     * Returns the JSON string to store in the db.
     */
    ipcMain.handle('entries:encryptPassword', async (event, plaintext: string) => {
        requireUnlocked(event)
        const key = getSessionKey()
        if (!key) throw new Error('Session is locked')
        return encryptToString(plaintext, key)
    })

    /**
     * Decrypts a stored password JSON string using the current session key.
     * Called from the renderer when showing or copying a password.
     */
    ipcMain.handle('entries:decryptPassword', async (event, stored: string, entryId: number) => {
        requireUnlocked(event)
        const key = getSessionKey()
        if (!key) throw new Error('Session is locked')
        try { return decryptFromString(stored, key, `entry:${entryId}`) } catch { return decryptFromString(stored, key) }
    })

    ipcMain.handle('entries:checkPasswordBreach', async (event, stored: string, entryId: number) => {
        requireUnlocked(event)
        try {
            const key = getSessionKey()
            if (!key) return { count: 0 }
            let plaintext: string
            try { plaintext = decryptFromString(stored, key, `entry:${entryId}`) } catch { plaintext = decryptFromString(stored, key) }
            return await checkPasswordBreach(plaintext)
        } catch (error) {
            console.error('Failed to check password breach', error)
            return { count: 0 }
        }
    })

    ipcMain.handle('entries:copyWithTimeout', async (event, password: string) => {
        requireUnlocked(event)
        try {
            await clipboard.writeText(password)
            if (clipboardTimeout) {
                clearTimeout(clipboardTimeout)
            }

            clipboardTimeout = setTimeout(
                async () => {
                    const current = await clipboard.readText()

                    if (current === password) {
                        await clipboard.writeText('')
                    }
                },
                parseInt(db.getSetting('clipboardTimeout') || '30000')
            )
        } catch (error) {
            console.error('Failed to copy password', error)
        }
    })

    /**
     * Fetches a favicon for a domain and returns it as a data URI.
     * Uses DuckDuckGo's favicon service.
     */
    ipcMain.handle('entries:fetchFavicon', async (event, domain: string) => {
        requireUnlocked(event)
        try {
            const faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`

            const buffer = await new Promise<Buffer>((resolve, reject) => {
                https
                    .get(faviconUrl, { timeout: 5000 }, (response) => {
                        const chunks: Buffer[] = []

                        response.on('data', (chunk: Buffer) => {
                            chunks.push(chunk)
                        })

                        response.on('end', () => {
                            resolve(Buffer.concat(chunks))
                        })

                        response.on('error', reject)
                    })
                    .on('error', reject)
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
