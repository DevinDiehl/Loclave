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
  }
}