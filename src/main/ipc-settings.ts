import { ipcMain, app, BrowserWindow, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { randomBytes } from 'crypto'
import * as db from '../db/db'
import {
    hashMasterPassword,
    verifyMasterPassword,
    deriveKey,
    getSessionKey,
    unlockSession,
    lockSession,
    logoutSession,
    setLockTimeout
} from '../cryptography/session'
import { clearKeyFromKeychain } from '../cryptography/keychain'
import { decryptFromString, encryptToString } from '../cryptography/crypto'
import { requireUnlocked } from './ipc-security'

export function registerSettingsHandlers(mainWindow: BrowserWindow): void {
    const saveValue = (key: string, value: string | number | boolean): void => {
        db.setSetting(key, value)
    }

    ipcMain.handle('settings:setClipboardTimeout', async (event, value: number) => {
        requireUnlocked(event)
        if (!Number.isSafeInteger(value) || value < 1_000 || value > 300_000) throw new Error('Invalid clipboard timeout')
        saveValue('clipboardTimeout', value)
        return { success: true }
    })

    ipcMain.handle('settings:setRequirePasswordOnCopy', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('requirePasswordOnCopy', value)
        return { success: true }
    })

    ipcMain.handle('settings:setTheme', async (event, value: string) => {
        requireUnlocked(event)
        saveValue('theme', value)
        return { success: true }
    })

    ipcMain.handle('settings:setCompactMode', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('compactMode', value)
        return { success: true }
    })

    ipcMain.handle('settings:setShowFavicons', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('showFavicons', value)
        return { success: true }
    })

    ipcMain.handle('settings:setStartOnLogin', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('startOnLogin', value)
        app.setLoginItemSettings({ openAtLogin: value })
        return { success: true }
    })

    ipcMain.handle('settings:setMinimizeToTray', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('minimizeToTray', value)
        app.setLoginItemSettings({ openAsHidden: value })
        return { success: true }
    })

    ipcMain.handle('settings:setCheckBreaches', async (event, value: boolean) => {
        requireUnlocked(event)
        saveValue('checkBreaches', value)
        return { success: true }
    })

    ipcMain.handle('settings:exportVault', async (event, masterPassword: string) => {
        requireUnlocked(event)
        if (!masterPassword) {
            throw new Error('Master password is required to export the vault')
        }

        const now = new Date()
        const dateStamp = now.toISOString().slice(0, 10)
        const result = await dialog.showSaveDialog(mainWindow, {
            title: 'Export encrypted vault backup',
            defaultPath: `password-keep-backup-${dateStamp}.pkvault`,
            buttonLabel: 'Export Backup',
            filters: [
                { name: 'Encrypted Vault Backup', extensions: ['pkvault'] },
                { name: 'JSON', extensions: ['json'] }
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        })

        if (result.canceled || !result.filePath) {
            return { success: false, canceled: true }
        }

        const snapshot = {
            exportedAt: now.toISOString(),
            appName: app.getName(),
            appVersion: app.getVersion(),
            folders: db.getAllFolders(),
            entries: db.getAllEntries(),
            settings: db.getAllSettings()
        }

        const backupSalt = randomBytes(32).toString('hex')
        const backupKey = deriveKey(masterPassword, backupSalt).key
        const encryptedPayload = encryptToString(JSON.stringify(snapshot), backupKey)
        const backup = {
            format: 'password-keep.encrypted-vault-backup',
            version: 1,
            createdAt: snapshot.exportedAt,
            encryption: {
                algorithm: 'aes-256-gcm',
                payloadEncoding: 'json',
                keyDerivation: 'scrypt',
                keySalt: backupSalt
            },
            payload: JSON.parse(encryptedPayload)
        }

        await writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8')
        return { success: true, canceled: false, filePath: result.filePath }
    })

    ipcMain.handle('settings:importVault', async (event, masterPassword: string) => {
        requireUnlocked(event)
        if (!masterPassword) {
            throw new Error('Master password is required to import the vault')
        }

        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Import encrypted vault backup',
            buttonLabel: 'Import Backup',
            filters: [
                { name: 'Encrypted Vault Backup', extensions: ['pkvault'] },
                { name: 'JSON', extensions: ['json'] }
            ],
            properties: ['openFile']
        })

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true }
        }

        const filePath = result.filePaths[0]
        const fileContents = await readFile(filePath, 'utf8')
        const snapshot = parseVaultBackup(fileContents, masterPassword)

        const confirmed = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Restore Backup', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'Restore encrypted vault backup',
            message: 'Restore this backup?',
            detail: `This will replace your current vault with ${snapshot.entries.length} entries and ${snapshot.folders.length} folders from the selected backup.`
        })

        if (confirmed.response !== 0) {
            return { success: false, canceled: true }
        }

        db.replaceVaultData(snapshot)

        const launchOnStartup = db.getSetting('startOnLogin')
        const minimizeToTray = db.getSetting('minimizeToTray')
        app.setLoginItemSettings({
            openAtLogin: launchOnStartup === 'true',
            openAsHidden: minimizeToTray === 'true'
        })

        const savedTimeout = db.getSetting('lock_timeout_ms')
        if (savedTimeout) {
            try { setLockTimeout(Number(savedTimeout)) } catch { db.deleteSetting('lock_timeout_ms') }
        }

        return {
            success: true,
            canceled: false,
            filePath,
            entryCount: snapshot.entries.length,
            folderCount: snapshot.folders.length
        }
    })

    ipcMain.handle('settings:deleteAllData', async (event) => {
        requireUnlocked(event)
        const confirmed = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: ['Delete Everything', 'Cancel'],
            defaultId: 1,
            cancelId: 1,
            title: 'Delete all vault data',
            message: 'Delete all vault data?',
            detail: 'This permanently deletes every folder, entry, setting, and your master password setup. This action cannot be undone unless you have an encrypted backup.'
        })

        if (confirmed.response !== 0) {
            return { success: false, canceled: true }
        }

        db.deleteAllData()
        app.setLoginItemSettings({ openAtLogin: false, openAsHidden: false })
        await logoutSession()

        setTimeout(() => {
            if (!mainWindow.isDestroyed()) {
                mainWindow.reload()
            }
        }, 100)

        return { success: true, canceled: false }
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
        async (event, currentPassword: string, newPassword: string) => {
            requireUnlocked(event)
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

            const reencrypted: Array<{ id: number; password: string }> = []
            for (const entry of allEntries) {
                try {
                    // Decrypt with old session key
                    let plainPassword: string
                    try { plainPassword = decryptFromString(entry.password, oldSessionKey, `entry:${entry.id}`) }
                    catch { plainPassword = decryptFromString(entry.password, oldSessionKey) }

                    // Re-encrypt with new session key
                    const newEncryptedPassword = encryptToString(plainPassword, newSessionKey, `entry:${entry.id}`)

                    reencrypted.push({ id: entry.id, password: newEncryptedPassword })
                } catch (err) {
                    console.error(`[settings] Failed to re-encrypt entry ${entry.id}:`, err)
                    throw new Error(
                        `Failed to re-encrypt entry "${entry.title}". Password change cancelled.`
                    )
                }
            }

            db.rotateEncryptedEntries(reencrypted, newMasterHash, newSaltHex)

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
    ipcMain.handle('settings:verifyMasterPassword', async (event, password: string) => {
        requireUnlocked(event)
        const storedHash = db.getSetting('master_hash')
        if (!storedHash) {
            return { success: false }
        }

        const isValid = await verifyMasterPassword(storedHash, password)
        return { success: isValid }
    })
}

type VaultBackupFolder = {
    id: number
    name: string
    icon?: string | null
    created_at?: string | null
    updated_at?: string | null
}

type VaultBackupEntry = {
    id: number
    folder_id: number
    title: string
    username: string | null
    password: string
    url: string | null
    notes: string | null
    favorite: 0 | 1
    created_at: string
    updated_at: string
}

type VaultBackupSetting = {
    key: string
    value: string
}

type VaultBackupSnapshot = {
    folders: VaultBackupFolder[]
    entries: VaultBackupEntry[]
    settings: VaultBackupSetting[]
}

function parseVaultBackup(fileContents: string, masterPassword: string): VaultBackupSnapshot {
    let backup: unknown
    try {
        backup = JSON.parse(fileContents)
    } catch {
        throw new Error('Backup file is not valid JSON')
    }

    if (!isRecord(backup) || backup.format !== 'password-keep.encrypted-vault-backup') {
        throw new Error('Backup file is not a Password Keep encrypted vault backup')
    }

    if (!isRecord(backup.encryption)) {
        throw new Error('Backup file is missing encryption metadata')
    }

    if (!isEncryptedPayload(backup.payload)) {
        throw new Error('Backup file is missing encrypted vault data')
    }

    const keySalt = typeof backup.encryption.keySalt === 'string' ? backup.encryption.keySalt : null
    if (!keySalt) {
        throw new Error(
            'Backup file is missing key salt metadata required for password-based decryption'
        )
    }

    const derivedKey = deriveKey(masterPassword, keySalt).key
    let plaintext: string
    try {
        plaintext = decryptFromString(JSON.stringify(backup.payload), derivedKey)
    } catch {
        throw new Error('Could not decrypt backup with the provided master password')
    }

    let snapshot: unknown
    try {
        snapshot = JSON.parse(plaintext)
    } catch {
        throw new Error('Backup decrypted, but the vault data is not valid JSON')
    }

    if (!isVaultBackupSnapshot(snapshot)) {
        throw new Error('Backup decrypted, but the vault data is not a supported format')
    }

    return snapshot
}

function isVaultBackupSnapshot(value: unknown): value is VaultBackupSnapshot {
    if (!isRecord(value)) return false
    return (
        Array.isArray(value.folders) &&
        value.folders.every(isVaultBackupFolder) &&
        Array.isArray(value.entries) &&
        value.entries.every(isVaultBackupEntry) &&
        Array.isArray(value.settings) &&
        value.settings.every(isVaultBackupSetting)
    )
}

function isVaultBackupFolder(value: unknown): value is VaultBackupFolder {
    if (!isRecord(value)) return false
    return (
        Number.isInteger(value.id) &&
        typeof value.name === 'string' &&
        (value.icon === undefined || value.icon === null || typeof value.icon === 'string') &&
        (value.created_at === undefined ||
            value.created_at === null ||
            typeof value.created_at === 'string') &&
        (value.updated_at === undefined ||
            value.updated_at === null ||
            typeof value.updated_at === 'string')
    )
}

function isVaultBackupEntry(value: unknown): value is VaultBackupEntry {
    if (!isRecord(value)) return false
    return (
        Number.isInteger(value.id) &&
        Number.isInteger(value.folder_id) &&
        typeof value.title === 'string' &&
        (value.username === null || typeof value.username === 'string') &&
        typeof value.password === 'string' &&
        (value.url === null || typeof value.url === 'string') &&
        (value.notes === null || typeof value.notes === 'string') &&
        (value.favorite === 0 || value.favorite === 1) &&
        typeof value.created_at === 'string' &&
        typeof value.updated_at === 'string'
    )
}

function isVaultBackupSetting(value: unknown): value is VaultBackupSetting {
    if (!isRecord(value)) return false
    return typeof value.key === 'string' && typeof value.value === 'string'
}

function isEncryptedPayload(value: unknown): boolean {
    if (!isRecord(value)) return false
    return (
        typeof value.iv === 'string' &&
        typeof value.authTag === 'string' &&
        typeof value.ciphertext === 'string'
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}
