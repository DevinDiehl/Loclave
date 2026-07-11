import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    requireUnlocked: vi.fn(),
    getSessionKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    getAllFolders: vi.fn(),
    getEntriesByFolder: vi.fn(),
    searchEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    toggleFavorite: vi.fn(),
    getSetting: vi.fn(),
    writeText: vi.fn(),
    readText: vi.fn(),
    openExternal: vi.fn()
}))

vi.mock('electron', () => ({
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) =>
            mocks.handlers.set(channel, handler)
        )
    },
    clipboard: { writeText: mocks.writeText, readText: mocks.readText },
    shell: { openExternal: mocks.openExternal }
}))
vi.mock('../db/db', () => ({
    getAllFolders: mocks.getAllFolders,
    getEntriesByFolder: mocks.getEntriesByFolder,
    searchEntries: mocks.searchEntries,
    createEntry: mocks.createEntry,
    updateEntry: mocks.updateEntry,
    deleteEntry: mocks.deleteEntry,
    toggleFavorite: mocks.toggleFavorite,
    getSetting: mocks.getSetting
}))
vi.mock('../cryptography/session', () => ({ getSessionKey: mocks.getSessionKey }))
vi.mock('../cryptography/crypto', () => ({
    encryptToString: mocks.encrypt,
    decryptFromString: mocks.decrypt
}))
vi.mock('./ipc-security', () => ({ requireUnlocked: mocks.requireUnlocked }))

import { registerEntryHandlers } from './ipc-entries'

const event = { sender: {} }
const invoke = (channel: string, ...args: unknown[]): Promise<unknown> =>
    Promise.resolve(mocks.handlers.get(channel)!(event, ...args))

describe('entry IPC handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.handlers.clear()
        mocks.getSessionKey.mockReturnValue(Buffer.alloc(32))
        registerEntryHandlers()
    })

    it('combines entries from every folder', async () => {
        mocks.getAllFolders.mockReturnValue([{ id: 1 }, { id: 2 }])
        mocks.getEntriesByFolder.mockImplementation((id) => [{ id: id * 10 }])
        await expect(invoke('entries:getAll')).resolves.toEqual([{ id: 10 }, { id: 20 }])
        expect(mocks.requireUnlocked).toHaveBeenCalledWith(event)
    })

    it('delegates folder queries, search, delete, and favorite toggles', async () => {
        mocks.getEntriesByFolder.mockReturnValue(['entry'])
        mocks.searchEntries.mockReturnValue(['match'])
        mocks.deleteEntry.mockReturnValue(true)
        mocks.toggleFavorite.mockReturnValue(false)
        await expect(invoke('entries:getByFolder', 3)).resolves.toEqual(['entry'])
        await expect(invoke('entries:search', 'mail')).resolves.toEqual(['match'])
        await expect(invoke('entries:delete', 8)).resolves.toEqual({ success: true })
        await expect(invoke('entries:toggleFavorite', 8)).resolves.toEqual({ success: false })
    })

    it('creates the row before encrypting with an entry-bound context', async () => {
        const input = {
            folderId: 2,
            title: 'Email',
            username: 'me',
            password: 'secret',
            url: null,
            notes: null
        }
        mocks.createEntry.mockReturnValue(7)
        mocks.encrypt.mockReturnValue('encrypted')
        await expect(invoke('entries:create', input)).resolves.toEqual({ id: 7 })
        expect(mocks.createEntry).toHaveBeenCalledWith({ ...input, password: '', favorite: 0 })
        expect(mocks.encrypt).toHaveBeenCalledWith('secret', expect.any(Buffer), 'entry:7')
        expect(mocks.updateEntry).toHaveBeenCalledWith({
            ...input,
            id: 7,
            password: 'encrypted',
            favorite: 0
        })
    })

    it('rejects encryption operations while the key is unavailable', async () => {
        mocks.getSessionKey.mockReturnValue(null)
        await expect(invoke('entries:encryptPassword', 'secret')).rejects.toThrow(
            'Session is locked'
        )
    })

    it('decrypts with entry-bound context and falls back for legacy ciphertext', async () => {
        mocks.decrypt
            .mockImplementationOnce(() => {
                throw new Error('legacy')
            })
            .mockReturnValueOnce('secret')
        await expect(invoke('entries:decryptPassword', 'stored', 9)).resolves.toBe('secret')
        expect(mocks.decrypt).toHaveBeenNthCalledWith(1, 'stored', expect.any(Buffer), 'entry:9')
        expect(mocks.decrypt).toHaveBeenNthCalledWith(2, 'stored', expect.any(Buffer))
    })

    it('copies a password and clears it only when the clipboard is unchanged', async () => {
        vi.useFakeTimers()
        mocks.getSetting.mockReturnValue('1000')
        mocks.readText.mockResolvedValue('secret')
        await invoke('entries:copyWithTimeout', 'secret')
        expect(mocks.writeText).toHaveBeenCalledWith('secret')
        await vi.advanceTimersByTimeAsync(1000)
        expect(mocks.writeText).toHaveBeenLastCalledWith('')
        vi.useRealTimers()
    })

    it('opens websites in the default browser and adds https when needed', async () => {
        await invoke('entries:openWebsite', 'example.com/login')
        expect(mocks.openExternal).toHaveBeenCalledWith('https://example.com/login')
    })

    it('rejects unsafe website protocols', async () => {
        await expect(invoke('entries:openWebsite', 'javascript:alert(1)')).rejects.toThrow(
            'Unsupported website protocol'
        )
        expect(mocks.openExternal).not.toHaveBeenCalled()
    })
})
