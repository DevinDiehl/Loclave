import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    requireUnlocked: vi.fn(),
    getAllFolders: vi.fn(),
    createFolder: vi.fn(),
    updateFolder: vi.fn(),
    deleteFolder: vi.fn()
}))

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
            mocks.handlers.set(channel, handler)
        )
    }
}))
vi.mock('../db/db', () => ({
    getAllFolders: mocks.getAllFolders,
    createFolder: mocks.createFolder,
    updateFolder: mocks.updateFolder,
    deleteFolder: mocks.deleteFolder
}))
vi.mock('./ipc-security', () => ({ requireUnlocked: mocks.requireUnlocked }))

import { registerFolderHandlers } from './ipc-folders'

const event = { sender: {} }
const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
    Promise.resolve(mocks.handlers.get(channel)!(event, ...args))

describe('folder IPC handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.handlers.clear()
        registerFolderHandlers()
    })

    it('registers every folder channel', () => {
        expect([...mocks.handlers.keys()]).toEqual([
            'folders:getAll',
            'folders:create',
            'folders:update',
            'folders:delete'
        ])
    })

    it('requires an unlocked session and returns all folders', async () => {
        const folders = [{ id: 1, name: 'Personal' }]
        mocks.getAllFolders.mockReturnValue(folders)
        await expect(invoke('folders:getAll')).resolves.toBe(folders)
        expect(mocks.requireUnlocked).toHaveBeenCalledWith(event)
    })

    it('creates folders with defaults', async () => {
        mocks.createFolder.mockReturnValue(12)
        await expect(invoke('folders:create', 'Work')).resolves.toEqual({ id: 12 })
        expect(mocks.createFolder).toHaveBeenCalledWith({
            name: 'Work',
            color: '#7c6dd8',
            sort_order: 0
        })
    })

    it('updates and deletes folders', async () => {
        mocks.updateFolder.mockReturnValue(true)
        mocks.deleteFolder.mockReturnValue(false)
        await expect(invoke('folders:update', 4, 'Archive', '#123456', 2)).resolves.toEqual({
            success: true
        })
        expect(mocks.updateFolder).toHaveBeenCalledWith({
            id: 4,
            name: 'Archive',
            color: '#123456',
            sort_order: 2
        })
        await expect(invoke('folders:delete', 4)).resolves.toEqual({ success: false })
        expect(mocks.deleteFolder).toHaveBeenCalledWith(4)
    })
})
