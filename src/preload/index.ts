import { contextBridge, ipcRenderer } from 'electron'
import { Entry, Folder } from '../types/types'
export interface Api {
    isFirstLaunch: () => Promise<boolean>
    setupMasterPassword: (password: string) => Promise<void>
    unlock: (password: string) => Promise<boolean>
    lock: () => Promise<void>
    logout: () => Promise<void>
    isUnlocked: () => Promise<boolean>
    setLockTimeout: (ms: number) => Promise<void>
    getAllFolders: () => Promise<Folder[]>
    createFolder: (name: string, color?: string, sortOrder?: number) => Promise<{ id: number }>
    updateFolder: (
        id: number,
        name: string,
        color?: string,
        sortOrder?: number
    ) => Promise<{ success: boolean }>
    deleteFolder: (id: number) => Promise<{ success: boolean }>
    exportFolderPdf: (folderId: number) => Promise<{ success: boolean; canceled: boolean; filePath?: string }>
    reportActivity: () => void
    onSessionLocked: (cb: () => void) => () => void
    getAllEntries: () => Promise<Entry[]>
    getEntriesByFolder: (folderId: number) => Promise<Entry[]>
    searchEntries: (query: string) => Promise<Entry[]>
    createEntry: (input: {
        folderId: number
        title: string
        username: string
        password: string
        url: string | null
        notes: string | null
    }) => Promise<{ id: number }>
    updateEntry: (input: {
        id: number
        folderId: number
        title: string
        username: string
        password: string
        url: string | null
        notes: string | null
        favorite: 0 | 1
    }) => Promise<{ success: boolean }>
    deleteEntry: (id: number) => Promise<{ success: boolean }>
    toggleFavorite: (id: number) => Promise<{ success: boolean }>
    encryptPassword: (plaintext: string) => Promise<string>
    decryptPassword: (stored: string, entryId: number) => Promise<string>
    checkPasswordBreach: (storedPassword: string, entryId: number) => Promise<{ count: number }>
    getSetting: (key: string) => Promise<string | undefined>
    saveSettings: (key: string, value: string | number | boolean) => Promise<void>
    saveClipboardTimeout: (value: number) => Promise<void>
    saveRequirePasswordOnCopy: (value: boolean) => Promise<void>
    saveTheme: (value: string) => Promise<void>
    saveCompactMode: (value: boolean) => Promise<void>
    saveShowFavicons: (value: boolean) => Promise<void>
    saveStartOnLogin: (value: boolean) => Promise<void>
    saveMinimizeToTray: (value: boolean) => Promise<void>
    saveCheckBreaches: (value: boolean) => Promise<void>
    copyWithTimeout: (password: string) => Promise<void>
    exportVault: (
        masterPassword: string
    ) => Promise<{ success: boolean; canceled: boolean; filePath?: string }>
    importVault: (masterPassword: string) => Promise<{
        success: boolean
        canceled: boolean
        filePath?: string
        entryCount?: number
        folderCount?: number
    }>
    deleteAllData: () => Promise<{ success: boolean; canceled: boolean }>
    changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<void>
    verifyMasterPassword: (password: string) => Promise<boolean>
    fetchFavicon: (domain: string) => Promise<string | null>
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

    createFolder: async (name: string, color?: string, sortOrder?: number) => {
        const res = await ipcRenderer.invoke(
            'folders:create',
            name,
            color ?? '#7c6dd8',
            sortOrder ?? 0
        )
        if (res?.error) throw new Error(res.error)
        return res
    },

    updateFolder: async (id: number, name: string, color?: string, sortOrder?: number) => {
        return await ipcRenderer.invoke(
            'folders:update',
            id,
            name,
            color ?? '#7c6dd8',
            sortOrder ?? 0
        )
    },

    deleteFolder: async (id: number) => {
        return await ipcRenderer.invoke('folders:delete', id)
    },
    exportFolderPdf: async (folderId: number) => {
        return await ipcRenderer.invoke('folders:exportPdf', folderId)
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
        title: string
        username: string
        password: string
        url: string | null
        notes: string | null
    }) => {
        return await ipcRenderer.invoke('entries:create', input)
    },

    updateEntry: async (input: {
        id: number
        folderId: number
        title: string
        username: string
        password: string
        url: string | null
        notes: string | null
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

    decryptPassword: async (stored: string, entryId: number): Promise<string> => {
        return await ipcRenderer.invoke('entries:decryptPassword', stored, entryId)
    },

    checkPasswordBreach: async (storedPassword: string, entryId: number): Promise<{ count: number }> => {
        return await ipcRenderer.invoke('entries:checkPasswordBreach', storedPassword, entryId)
    },

    getSetting: async (key: string): Promise<string | undefined> => {
        const res = await ipcRenderer.invoke('db:getSetting', key)
        return res.value
    },

    saveSettings: async (key: string, value: string | number | boolean): Promise<void> => {
        await ipcRenderer.invoke('db:saveSetting', key, value)
    },

    saveClipboardTimeout: async (value: number): Promise<void> => {
        await ipcRenderer.invoke('settings:setClipboardTimeout', value)
    },

    saveRequirePasswordOnCopy: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setRequirePasswordOnCopy', value)
    },

    saveTheme: async (value: string): Promise<void> => {
        await ipcRenderer.invoke('settings:setTheme', value)
    },

    saveCompactMode: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setCompactMode', value)
    },

    saveShowFavicons: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setShowFavicons', value)
    },

    saveStartOnLogin: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setStartOnLogin', value)
    },

    saveMinimizeToTray: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setMinimizeToTray', value)
    },

    saveCheckBreaches: async (value: boolean): Promise<void> => {
        await ipcRenderer.invoke('settings:setCheckBreaches', value)
    },

    copyWithTimeout: async (password: string): Promise<void> => {
        await ipcRenderer.invoke('entries:copyWithTimeout', password)
    },

    exportVault: async (
        masterPassword: string
    ): Promise<{ success: boolean; canceled: boolean; filePath?: string }> => {
        return await ipcRenderer.invoke('settings:exportVault', masterPassword)
    },

    importVault: async (
        masterPassword: string
    ): Promise<{
        success: boolean
        canceled: boolean
        filePath?: string
        entryCount?: number
        folderCount?: number
    }> => {
        return await ipcRenderer.invoke('settings:importVault', masterPassword)
    },

    deleteAllData: async (): Promise<{ success: boolean; canceled: boolean }> => {
        return await ipcRenderer.invoke('settings:deleteAllData')
    },

    changeMasterPassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        await ipcRenderer.invoke('settings:changeMasterPassword', currentPassword, newPassword)
    },

    verifyMasterPassword: async (password: string): Promise<boolean> => {
        const res = await ipcRenderer.invoke('settings:verifyMasterPassword', password)
        return res.success
    },

    fetchFavicon: async (domain: string): Promise<string | null> => {
        const res = await ipcRenderer.invoke('entries:fetchFavicon', domain)
        return res.dataUri || null
    }
} satisfies Api)
