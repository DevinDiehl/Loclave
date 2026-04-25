import { contextBridge, ipcRenderer } from 'electron'
export interface Api {
  isFirstLaunch:      ()                    => Promise<boolean>
  setupMasterPassword:(password: string)    => Promise<void>
  unlock:             (password: string)    => Promise<boolean>
  lock:               ()                    => Promise<void>
  logout:             ()                    => Promise<void>
  isUnlocked:         ()                    => Promise<boolean>
  setLockTimeout:     (ms: number)          => Promise<void>

  // Activity — call this from the renderer on any user interaction
  // so the main process can reset the idle timer
  reportActivity:     ()                    => void

  // Events — renderer listens for lock events pushed from main
  onSessionLocked:    (cb: () => void)      => () => void
}

contextBridge.exposeInMainWorld('api', {

  isFirstLaunch: async (): Promise<boolean> => {
    const res = await ipcRenderer.invoke('session:isFirstLaunch')
    return res.isFirstLaunch
  },

  setupMasterPassword: async (password: string): Promise<void> => {
    await ipcRenderer.invoke('session:setup', password)
  },

  unlock: async (password: string): Promise<boolean> => {
    const res = await ipcRenderer.invoke('session:unlock', password)
    return res.success
  },

  lock: async (): Promise<void> => {
    await ipcRenderer.invoke('session:lock')
  },

  logout: async (): Promise<void> => {
    await ipcRenderer.invoke('session:logout')
  },

  isUnlocked: async (): Promise<boolean> => {
    const res = await ipcRenderer.invoke('session:isUnlocked')
    return res.unlocked
  },

  setLockTimeout: async (ms: number): Promise<void> => {
    await ipcRenderer.invoke('session:setLockTimeout', ms)
  },

  reportActivity: (): void => {
    ipcRenderer.send('user:activity')
  },

  /**
   * Subscribe to session lock events pushed from the main process.
   * @returns an unsubscribe function — call it in useEffect cleanup.
   */
  onSessionLocked: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('session:locked', handler)
    return () => ipcRenderer.removeListener('session:locked', handler)
  },

} satisfies Api)