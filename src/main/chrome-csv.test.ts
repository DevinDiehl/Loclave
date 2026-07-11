import { describe, expect, it } from 'vitest'
import { parseChromePasswordCsv } from './chrome-csv'

describe('parseChromePasswordCsv', () => {
    it('maps Chrome columns and supports quoted commas and newlines', () => {
        const csv = 'name,url,username,password,note\r\n"Example, Inc",https://example.com,user,"p""ass","line 1\nline 2"\r\n'
        expect(parseChromePasswordCsv(csv)).toEqual([{
            name: 'Example, Inc', url: 'https://example.com', username: 'user', password: 'p"ass', note: 'line 1\nline 2'
        }])
    })

    it('rejects files without the Chrome headers', () => {
        expect(() => parseChromePasswordCsv('title,login\nExample,user')).toThrow(/must contain/)
    })
})
