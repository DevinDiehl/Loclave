/// <reference types="vite/client" />

interface Window {
    api: {
        isFirstLaunch: () => Promise<boolean>
        setupMasterPassword: (password: string) => Promise<void>
        unlock: (password: string) => Promise<boolean>
        lock: () => Promise<void>
        logout: () => Promise<void>
        isUnlocked: () => Promise<boolean>
        setLockTimeout: (ms: number) => Promise<void>
        reportActivity: () => void
        onSessionLocked: (cb: () => void) => () => void
        getAllFolders: () => Promise<Folder[]>
        createFolder: (name: string) => Promise<{ id: number }>
        updateFolder: (id: number, name: string) => Promise<{ success: boolean }>
        deleteFolder: (id: number) => Promise<{ success: boolean }>
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
        decryptPassword: (stored: string) => Promise<string>
        checkPasswordBreach: (storedPassword: string) => Promise<{ count: number }>
        getSetting: (key: string) => Promise<string | undefined>
        saveSettings: (key: string, value: string | number | boolean) => Promise<void>
        saveClipboardTimeout: (value: number) => Promise<void>
        saveRequirePasswordOnCopy: (value: boolean) => Promise<void>
        saveShowPasswordStrength: (value: boolean) => Promise<void>
        saveTheme: (value: string) => Promise<void>
        saveCompactMode: (value: boolean) => Promise<void>
        saveShowFavicons: (value: boolean) => Promise<void>
        saveStartOnLogin: (value: boolean) => Promise<void>
        saveMinimizeToTray: (value: boolean) => Promise<void>
        saveCheckBreaches: (value: boolean) => Promise<void>
        copyWithTimeout: (password: string) => Promise<void>
        exportVault: () => Promise<{ success: boolean; canceled: boolean; filePath?: string }>
        importVault: () => Promise<{
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
}
