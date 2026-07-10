import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fromWebContents: vi.fn(), isUnlocked: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: { fromWebContents: mocks.fromWebContents } }))
vi.mock('../cryptography/session', () => ({ isUnlocked: mocks.isUnlocked }))

import { requireTrustedRenderer, requireUnlocked } from './ipc-security'

describe('IPC sender security', () => {
    const sender = { getURL: vi.fn(() => 'app://renderer'), id: 1 }
    const event = { sender, senderFrame: { url: 'app://renderer' } }

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.fromWebContents.mockReturnValue({ webContents: sender })
        mocks.isUnlocked.mockReturnValue(true)
    })

    it('accepts the matching renderer and unlocked session', () => {
        expect(() => requireTrustedRenderer(event as never)).not.toThrow()
        expect(() => requireUnlocked(event as never)).not.toThrow()
    })

    it('rejects unknown windows, mismatched frames, and locked sessions', () => {
        mocks.fromWebContents.mockReturnValueOnce(null)
        expect(() => requireTrustedRenderer(event as never)).toThrow('Untrusted IPC sender')
        expect(() =>
            requireTrustedRenderer({ ...event, senderFrame: { url: 'https://evil.test' } } as never)
        ).toThrow('Untrusted IPC sender')
        mocks.isUnlocked.mockReturnValue(false)
        expect(() => requireUnlocked(event as never)).toThrow('Session is locked')
    })
})
