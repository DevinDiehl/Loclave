import { contextBridge, ipcRenderer } from 'electron'
import { Entry, Folder } from '../types/types'
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
  getAllEntries:       ()                          => Promise<Entry[]>
  getEntriesByFolder: (folderId: number)           => Promise<Entry[]>
  searchEntries:      (query: string)              => Promise<Entry[]>
  createEntry:        (input: {
    folderId: number; title: string; username: string
    password: string; url: string | null; notes: string | null
  })                                               => Promise<{ id: number }>
  updateEntry:        (input: {
    id: number; folderId: number; title: string; username: string
    password: string; url: string | null; notes: string | null; favorite: 0 | 1
  })                                               => Promise<{ success: boolean }>
  deleteEntry:        (id: number)                 => Promise<{ success: boolean }>
  toggleFavorite:     (id: number)                 => Promise<{ success: boolean }>
  encryptPassword:    (plaintext: string)           => Promise<string>
  decryptPassword:    (stored: string)              => Promise<string>

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
  getAllEntries: async () => {
    return await ipcRenderer.invoke('entries:getAll')
  },
 
  getEntriesByFolder: async (folderId: number) => {
    return await ipcRenderer.invoke('entries:getByFolder', folderId)
  },
 
  searchEntries: async (query: string) => {
    return await ipcRenderer.invoke('entries:search', query)
  },
 
  createEntry: async (input: {
    folderId: number
    title:    string
    username: string
    password: string
    url:      string | null
    notes:    string | null
  }) => {
    return await ipcRenderer.invoke('entries:create', input)
  },
 
  updateEntry: async (input: {
    id:       number
    folderId: number
    title:    string
    username: string
    password: string
    url:      string | null
    notes:    string | null
    favorite: 0 | 1
  }) => {
    return await ipcRenderer.invoke('entries:update', input)
  },
 
  deleteEntry: async (id: number) => {
    return await ipcRenderer.invoke('entries:delete', id)
  },
 
  toggleFavorite: async (id: number) => {
    return await ipcRenderer.invoke('entries:toggleFavorite', id)
  },
 
  encryptPassword: async (plaintext: string): Promise<string> => {
    return await ipcRenderer.invoke('entries:encryptPassword', plaintext)
  },
 
  decryptPassword: async (stored: string): Promise<string> => {
    return await ipcRenderer.invoke('entries:decryptPassword', stored)
  },

} satisfies Api)