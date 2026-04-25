import { contextBridge, ipcRenderer } from 'electron'
import { Folder } from '../types/types'
export interface Api {
  isFirstLaunch:      ()                    => Promise<boolean>
  setupMasterPassword:(password: string)    => Promise<void>
  unlock:             (password: string)    => Promise<boolean>
  lock:               ()                    => Promise<void>
  logout:             ()                    => Promise<void>
  isUnlocked:         ()                    => Promise<boolean>
  setLockTimeout:     (ms: number)          => Promise<void>
  getAllFolders: ()                         => Promise<Folder[]>
  createFolder: (name: string)             => Promise<{ id: number }>
  updateFolder: (id: number, name: string) => Promise<{ success: boolean }>
  deleteFolder: (id: number)               => Promise<{ success: boolean }>

  reportActivity:     ()                    => void
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

  onSessionLocked: (cb: () => void): (() => void) => {
    const handler = () => cb()
    ipcRenderer.on('session:locked', handler)
    return () => ipcRenderer.removeListener('session:locked', handler)
  },

   getAllFolders: async () => {
    return await ipcRenderer.invoke('folders:getAll')
  },
 
  createFolder: async (name: string) => {
    const res = await ipcRenderer.invoke('folders:create', name)
    if (res?.error) throw new Error(res.error)
    return res
  },
 
  updateFolder: async (id: number, name: string) => {
    return await ipcRenderer.invoke('folders:update', id, name)
  },
 
  deleteFolder: async (id: number) => {
    return await ipcRenderer.invoke('folders:delete', id)
  },

} satisfies Api)