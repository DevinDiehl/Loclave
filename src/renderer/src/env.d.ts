/// <reference types="vite/client" />

interface Window {
  api: {
    isFirstLaunch:       ()                 => Promise<boolean>
    setupMasterPassword: (password: string) => Promise<void>
    unlock:              (password: string) => Promise<boolean>
    lock:                ()                 => Promise<void>
    logout:              ()                 => Promise<void>
    isUnlocked:          ()                 => Promise<boolean>
    setLockTimeout:      (ms: number)       => Promise<void>
    reportActivity:      ()                 => void
    onSessionLocked:     (cb: () => void)   => () => void
    getAllFolders: ()                         => Promise<Folder[]>
    createFolder: (name: string)             => Promise<{ id: number }>
    updateFolder: (id: number, name: string) => Promise<{ success: boolean }>
    deleteFolder: (id: number)               => Promise<{ success: boolean }>
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
}