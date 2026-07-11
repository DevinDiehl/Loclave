export type ChromePasswordRow = {
    name: string
    url: string
    username: string
    password: string
    note: string
}

const REQUIRED_HEADERS = ['name', 'url', 'username', 'password', 'note'] as const

export function parseChromePasswordCsv(contents: string): ChromePasswordRow[] {
    const rows = parseCsv(contents.replace(/^\uFEFF/, ''))
    if (rows.length === 0) throw new Error('Chrome CSV file is empty')

    const headers = rows[0].map((header) => header.trim().toLowerCase())
    const indexes = Object.fromEntries(REQUIRED_HEADERS.map((header) => [header, headers.indexOf(header)]))
    if (REQUIRED_HEADERS.some((header) => indexes[header] === -1)) {
        throw new Error(`Chrome CSV must contain these columns: ${REQUIRED_HEADERS.join(', ')}`)
    }

    return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row, index) => {
        const value = (header: typeof REQUIRED_HEADERS[number]): string => row[indexes[header]] ?? ''
        const name = value('name').trim()
        if (!name) throw new Error(`Chrome CSV row ${index + 2} is missing a name`)
        return {
            name,
            url: value('url').trim(),
            username: value('username'),
            password: value('password'),
            note: value('note')
        }
    })
}

function parseCsv(contents: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ''
    let quoted = false

    for (let i = 0; i < contents.length; i += 1) {
        const char = contents[i]
        if (quoted) {
            if (char === '"' && contents[i + 1] === '"') { field += '"'; i += 1 }
            else if (char === '"') quoted = false
            else field += char
        } else if (char === '"' && field.length === 0) quoted = true
        else if (char === ',') { row.push(field); field = '' }
        else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
        else if (char !== '\r') field += char
    }
    if (quoted) throw new Error('Chrome CSV contains an unterminated quoted field')
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
    return rows
}
