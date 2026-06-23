import { ipcMain } from 'electron'
import * as db from '../db/db'
import {
    hashMasterPassword,
    verifyMasterPassword,
    deriveKey,
    getSessionKey,
    unlockSession,
    lockSession
} from '../cryptography/session'
import { clearKeyFromKeychain } from '../cryptography/keychain'
import { decryptFromString, encryptToString } from '../cryptography/crypto'

export function registerSettingsHandlers(): void {
    const saveValue = (key: string, value: string | number | boolean) => {
        db.setSetting(key, value)
    }

    ipcMain.handle('settings:setClipboardTimeout', async (_event, value: number) => {
        saveValue('clipboardTimeout', value)
        return { success: true }
    })

    ipcMain.handle('settings:setRequirePasswordOnCopy', async (_event, value: boolean) => {
        saveValue('requirePasswordOnCopy', value)
        return { success: true }
    })

    ipcMain.handle('settings:setShowPasswordStrength', async (_event, value: boolean) => {
        saveValue('showPasswordStrength', value)
        return { success: true }
    })

    ipcMain.handle('settings:setTheme', async (_event, value: string) => {
        saveValue('theme', value)
        return { success: true }
    })

    ipcMain.handle('settings:setCompactMode', async (_event, value: boolean) => {
        saveValue('compactMode', value)
        return { success: true }
    })

    ipcMain.handle('settings:setShowFavicons', async (_event, value: boolean) => {
        saveValue('showFavicons', value)
        return { success: true }
    })

    ipcMain.handle('settings:setStartOnLogin', async (_event, value: boolean) => {
        saveValue('startOnLogin', value)
        return { success: true }
    })

    ipcMain.handle('settings:setMinimizeToTray', async (_event, value: boolean) => {
        saveValue('minimizeToTray', value)
        return { success: true }
    })

    ipcMain.handle('settings:setCheckBreaches', async (_event, value: boolean) => {
        saveValue('checkBreaches', value)
        return { success: true }
    })

    /**
     * Changes the master password and re-encrypts all entries.
     * This is a complex operation that:
     * 1. Verifies the current password
     * 2. Derives a new key from the new password
     * 3. Decrypts all entries with the old session key
     * 4. Re-encrypts all entries with the new session key
     * 5. Updates the master hash and key salt
     * 6. Unlocks the session with the new key
     */
    ipcMain.handle(
        'settings:changeMasterPassword',
        async (_event, currentPassword: string, newPassword: string) => {
            // Verify current password
            const storedHash = db.getSetting('master_hash')
            if (!storedHash) {
                throw new Error('No master password set')
            }

            const isValid = await verifyMasterPassword(storedHash, currentPassword)
            if (!isValid) {
                throw new Error('Current password is incorrect')
            }

            // Get the current session key to decrypt existing passwords
            const oldSessionKey = getSessionKey()
            if (!oldSessionKey) {
                throw new Error('Session not unlocked')
            }

            // Hash the new password
            const newMasterHash = await hashMasterPassword(newPassword)

            // Derive new encryption key from new password
            const { key: newSessionKey, saltHex: newSaltHex } = deriveKey(newPassword)

            // Get all entries
            const folders = db.getAllFolders()
            const allEntries = folders.flatMap((f) => db.getEntriesByFolder(f.id))

            // Re-encrypt all entries with the new session key
            for (const entry of allEntries) {
                try {
                    // Decrypt with old session key
                    const plainPassword = decryptFromString(entry.password, oldSessionKey)

                    // Re-encrypt with new session key
                    const newEncryptedPassword = encryptToString(plainPassword, newSessionKey)

                    // Update entry in database
                    db.updateEntry({
                        id: entry.id,
                        folderId: entry.folder_id,
                        title: entry.title,
                        username: entry.username || '',
                        password: newEncryptedPassword,
                        url: entry.url || null,
                        notes: entry.notes || null,
                        favorite: entry.favorite
                    })
                } catch (err) {
                    console.error(`[settings] Failed to re-encrypt entry ${entry.id}:`, err)
                    throw new Error(
                        `Failed to re-encrypt entry "${entry.title}". Password change cancelled.`
                    )
                }
            }

            // Update the master password hash and key salt in settings
            db.setSetting('master_hash', newMasterHash)
            db.setSetting('key_salt', newSaltHex)

            // Lock the current session to clear the old key
            lockSession()

            // Clear the old keychain entry
            await clearKeyFromKeychain()

            // Unlock with the new session key (saves new key to keychain)
            await unlockSession(newSessionKey)

            return { success: true }
        }
    )

    /**
     * Verifies the master password without changing anything.
     * Used for operations that require password confirmation (e.g., copy with password).
     */
    ipcMain.handle('settings:verifyMasterPassword', async (_event, password: string) => {
        const storedHash = db.getSetting('master_hash')
        if (!storedHash) {
            return { success: false }
        }

        const isValid = await verifyMasterPassword(storedHash, password)
        return { success: isValid }
    })
}
