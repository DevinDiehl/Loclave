import { ipcMain, BrowserWindow } from 'electron'
import * as db                    from '../db/db'
import {
  hashMasterPassword,
  verifyMasterPassword,
  deriveKey,
  unlockSession,
  lockSession,
  logoutSession,
  isUnlocked,
  onLock,
  setLockTimeout,
  resetLockTimer,
} from '../cryptography/session'
import {registerFolderHandlers} from './ipc-folders'
import {registerEntryHandlers} from './ipc-entries'
import {registerSettingsHandlers} from './ipc-settings'
import { requireTrustedRenderer } from './ipc-security'
/**
 * Call this once from main.ts after the BrowserWindow is created.
 * Registers all IPC handlers and wires up the lock callback.
 *
 * @param mainWindow  The main BrowserWindow instance
 */
export function registerIpcHandlers(mainWindow: BrowserWindow): void {

  // When the session locks (idle timeout or manual), tell the renderer
  onLock(() => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:locked')
    }
  })

  // Load lock timeout preference from settings
  const savedTimeout = db.getSetting('lock_timeout_ms')
  if (savedTimeout) {
    try { setLockTimeout(Number(savedTimeout)) } catch { db.deleteSetting('lock_timeout_ms') }
  }

  // Reset idle timer on any activity signal from renderer
  ipcMain.on('user:activity', (event) => {
    try { requireTrustedRenderer(event as never); resetLockTimer() } catch { /* ignore untrusted senders */ }
  })


  /**
   * Check whether a master password has been set up yet.
   * The renderer calls this on launch to decide which screen to show.
   * @returns: { isFirstLaunch: boolean }
   */
  ipcMain.handle('session:isFirstLaunch', async () => {
    const hash = db.getSetting('master_hash')
    return { isFirstLaunch: !hash }
  })

  /**
   * First-launch only — hash the master password, derive & store the key salt,
   * then unlock the session.
   * @returns: { success: true }
   */
  ipcMain.handle('session:setup', async (event, masterPassword: string) => {
    requireTrustedRenderer(event)
    if (db.getSetting('master_hash')) throw new Error('Master password is already configured')
    if (typeof masterPassword !== 'string' || masterPassword.length < 1) throw new Error('Master password is required')
    // Hash the master password
    const masterHash = await hashMasterPassword(masterPassword)
    db.setSetting('master_hash', masterHash)

    // Derive encryption key + generate new salt
    const { key, saltHex } = deriveKey(masterPassword)
    db.setSetting('key_salt', saltHex)

    // Unlock the session
    await unlockSession(key)

    return { success: true }
  })

  /**
   * Unlock with the master password.
   * Returns: { success: boolean }
   */
  ipcMain.handle('session:unlock', async (_event, masterPassword: string) => {
    const storedHash = db.getSetting('master_hash')
    if (!storedHash) return { success: false }

    const valid = await verifyMasterPassword(storedHash, masterPassword)
    if (!valid) return { success: false }

    const saltHex    = db.getSetting('key_salt') ?? undefined
    const { key }    = deriveKey(masterPassword, saltHex)
    await unlockSession(key)

    return { success: true }
  })

  /**
   * Manually lock the session (e.g. user clicks "Lock" in the UI).
   */
  ipcMain.handle('session:lock', async () => {
    lockSession()
    return { success: true }
  })

  /**
   * Full logout — clears Keychain entry too.
   */
  ipcMain.handle('session:logout', async () => {
    await logoutSession()
    return { success: true }
  })

  /**
   * @returns whether the session is currently unlocked.
   * Useful for the renderer to check state on focus/resume.
   */
  ipcMain.handle('session:isUnlocked', async () => {
    return { unlocked: isUnlocked() }
  })

  /**
   * Update the idle lock timeout.
   * @param ms  Milliseconds (e.g. 5 * 60 * 1000 for 5 minutes)
   */
  ipcMain.handle('session:setLockTimeout', async (event, ms: number) => {
    requireTrustedRenderer(event)
    if (!Number.isSafeInteger(ms) || ms < 60_000 || ms > 86_400_000) throw new Error('Invalid lock timeout')
    setLockTimeout(ms)
    db.setSetting('lock_timeout_ms', String(ms))
    return { success: true }
  })

  ipcMain.handle('db:getSetting', async (event, key: string) => {
    requireTrustedRenderer(event)
    const allowed = new Set(['theme','compactMode','showFavicons','startOnLogin','minimizeToTray','checkBreaches','clipboardTimeout','requirePasswordOnCopy','lock_timeout_ms'])
    if (!allowed.has(key)) throw new Error('Unknown setting')
    const value = db.getSetting(key)
    return { value }
  })

  ipcMain.handle('db:saveSetting', async (event, key: string, value: string | number | boolean) => {
    requireTrustedRenderer(event)
    const allowed = new Set(['theme','compactMode','showFavicons','startOnLogin','minimizeToTray','checkBreaches','clipboardTimeout','requirePasswordOnCopy'])
    if (!allowed.has(key)) throw new Error('Setting is not writable')
    db.setSetting(key, String(value))
    return { success: true }
  })

  registerFolderHandlers()
  registerEntryHandlers()
  registerSettingsHandlers(mainWindow)

}
