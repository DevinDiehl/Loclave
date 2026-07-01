import Database, { Database as DatabaseType, Statement } from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { Folder,
         Entry,
         CreateEntryInput,
         UpdateEntryInput, 
         CreateFolderInput, 
         UpdateFolderInput  
        } 
        from '../types/types';



let db: DatabaseType | null = null;
export function init(): DatabaseType {
  const dbPath = path.join(app.getPath('userData'), 'passwords.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  console.log('[db] Opened:', dbPath);
  return db;
}

export function close(): void {
  if (db?.open) {
    db.close();
    console.log('[db] Closed.');
  }
}

function getDb(): DatabaseType {
  if (!db) throw new Error('[db] Database not initialized. Call db.init() first.');
  return db;
}

function createTables(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      icon       TEXT    DEFAULT 'folder',
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id  INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      title      TEXT    NOT NULL,
      username   TEXT,
      password   TEXT    NOT NULL,
      url        TEXT,
      notes      TEXT,
      favorite   INTEGER DEFAULT 0,
      created_at TEXT    DEFAULT (datetime('now')),
      updated_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

const stmts: Record<string, Statement> = {};

interface RestoredFolder {
  id: number
  name: string
  icon?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface RestoredSetting {
  key: string
  value: string
}

interface VaultRestoreSnapshot {
  folders: RestoredFolder[]
  entries: Entry[]
  settings: RestoredSetting[]
}

function stmt(key: string, sql: string): Statement {
  if (!stmts[key]) {
    stmts[key] = getDb().prepare(sql);
  }
  return stmts[key];
}

/**
 * @returns all folders, each with an additional `entry_count` property.
 */
export function getAllFolders(): Folder[] {
  return stmt('folders.getAll', `
    SELECT f.*, COUNT(e.id) AS entry_count
    FROM   folders f
    LEFT JOIN entries e ON e.folder_id = f.id
    GROUP  BY f.id
    ORDER  BY f.name COLLATE NOCASE
  `).all() as Folder[];
}

/**
 * @returns a single folder by ID, or undefined.
 */ 
export function getFolderById(id: number): Folder | undefined {
  return stmt('folders.getById', `
    SELECT * FROM folders WHERE id = ?
  `).get(id) as Folder | undefined;
}

/**
 * Creates a new folder.
 * @returns ID of the new folder
 * @throws if name already exists (UNIQUE constraint)
 */
export function createFolder({ name, icon = 'folder' }: CreateFolderInput): number {
  const result = stmt('folders.insert', `
    INSERT INTO folders (name, icon) VALUES (@name, @icon)
  `).run({ name, icon });

  return result.lastInsertRowid as number;
}

/**
 * Updates a folder's name and/or icon.
 * @returns true if a row was updated
 */
export function updateFolder({ id, name, icon = 'folder' }: UpdateFolderInput): boolean {
  const result = stmt('folders.update', `
    UPDATE folders
    SET    name = @name, icon = @icon, updated_at = datetime('now')
    WHERE  id   = @id
  `).run({ id, name, icon });

  return result.changes > 0;
}

/**
 * @deletes a folder and ALL its entries (via ON DELETE CASCADE).
 * @returns true if a row was deleted
 */
export function deleteFolder(id: number): boolean {
  const result = stmt('folders.delete', `
    DELETE FROM folders WHERE id = ?
  `).run(id);

  return result.changes > 0;
}


/**
 * @returns all entries inside a folder, sorted by title.
 */
export function getEntriesByFolder(folderId: number): Entry[] {
  return stmt('entries.getByFolder', `
    SELECT * FROM entries
    WHERE  folder_id = ?
    ORDER  BY title COLLATE NOCASE
  `).all(folderId) as Entry[];
}

/**
 * @returns all entries in the vault, sorted by folder and title.
 */
export function getAllEntries(): Entry[] {
  return stmt('entries.getAll', `
    SELECT * FROM entries
    ORDER BY folder_id, title COLLATE NOCASE
  `).all() as Entry[];
}

/**
 * Returns a single entry by ID, or undefined.
 */
export function getEntryById(id: number): Entry | undefined {
  return stmt('entries.getById', `
    SELECT * FROM entries WHERE id = ?
  `).get(id) as Entry | undefined;
}

/**
 * Returns all entries marked as favorite.
 */
export function getFavoriteEntries(): Entry[] {
  return stmt('entries.getFavorites', `
    SELECT * FROM entries WHERE favorite = 1 ORDER BY title COLLATE NOCASE
  `).all() as Entry[];
}

/**
 * Creates a new password entry.
 *
 *
 * @returns ID of the new entry
 */
export function createEntry({
  folderId,
  title,
  username,
  password,
  url      = null,
  notes    = null,
  favorite = 0,
}: CreateEntryInput): number {
  const result = stmt('entries.insert', `
    INSERT INTO entries (folder_id, title, username, password, url, notes, favorite)
    VALUES (@folderId, @title, @username, @password, @url, @notes, @favorite)
  `).run({ folderId, title, username, password, url, notes, favorite });

  return result.lastInsertRowid as number;
}

/**
 * Updates an existing entry. All fields are replaced.
 * @returns true if a row was updated
 */
export function updateEntry({
  id,
  folderId,
  title,
  username,
  password,
  url      = null,
  notes    = null,
  favorite = 0,
}: UpdateEntryInput): boolean {
  const result = stmt('entries.update', `
    UPDATE entries
    SET    folder_id  = @folderId,
           title      = @title,
           username   = @username,
           password   = @password,
           url        = @url,
           notes      = @notes,
           favorite   = @favorite,
           updated_at = datetime('now')
    WHERE  id = @id
  `).run({ id, folderId, title, username, password, url, notes, favorite });

  return result.changes > 0;
}

/**
 * Deletes a single entry.
 * @returns true if a row was deleted
 */
export function deleteEntry(id: number): boolean {
  const result = stmt('entries.delete', `
    DELETE FROM entries WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

/**
 * Toggles the favorite flag on an entry (0 → 1, 1 → 0).
 * @returns true if updated
 */
export function toggleFavorite(id: number): boolean {
  const result = stmt('entries.toggleFav', `
    UPDATE entries
    SET    favorite   = CASE WHEN favorite = 1 THEN 0 ELSE 1 END,
           updated_at = datetime('now')
    WHERE  id = ?
  `).run(id);

  return result.changes > 0;
}

/**
 * Full-text search across title, username, url, and notes.
 * @returns entries with their folder_name included.
 */
export function searchEntries(query: string): Entry[] {
  const term = `%${query}%`;
  return stmt('entries.search', `
    SELECT e.*, f.name AS folder_name
    FROM   entries e
    JOIN   folders f ON f.id = e.folder_id
    WHERE  e.title    LIKE @term
    OR     e.username LIKE @term
    OR     e.url      LIKE @term
    OR     e.notes    LIKE @term
    ORDER  BY e.title COLLATE NOCASE
  `).all({ term }) as Entry[];
}

/**
 * @moves all entries from one folder to another, then @deletes the source folder.
 * Wrapped in a transaction so it's all-or-nothing.
 */
export function moveEntriesToFolder(fromFolderId: number, toFolderId: number): void {
  const database = getDb();

  const run = database.transaction(() => {
    database.prepare(`UPDATE entries SET folder_id = ? WHERE folder_id = ?`).run(toFolderId, fromFolderId);
    database.prepare(`DELETE FROM folders WHERE id = ?`).run(fromFolderId);
  });

  run();
}

/**
 * @reads a setting value by key. Returns undefined if not set.
 */
export function getSetting(key: string): string | undefined {
  const row = getDb().prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;

  return row?.value;
}

/**
 * @returns all settings as key/value rows.
 */
export function getAllSettings(): { key: string; value: string }[] {
  return stmt('settings.getAll', `
    SELECT key, value FROM settings ORDER BY key COLLATE NOCASE
  `).all() as { key: string; value: string }[];
}

/**
 * Replaces all vault tables from a validated backup snapshot.
 */
export function replaceVaultData(snapshot: VaultRestoreSnapshot): void {
  const database = getDb();

  const restore = database.transaction(() => {
    database.prepare(`DELETE FROM entries`).run();
    database.prepare(`DELETE FROM folders`).run();
    database.prepare(`DELETE FROM settings`).run();

    const insertFolder = database.prepare(`
      INSERT INTO folders (id, name, icon, created_at, updated_at)
      VALUES (@id, @name, @icon, @created_at, @updated_at)
    `);
    const insertEntry = database.prepare(`
      INSERT INTO entries (
        id, folder_id, title, username, password, url, notes, favorite, created_at, updated_at
      )
      VALUES (
        @id, @folder_id, @title, @username, @password, @url, @notes, @favorite, @created_at, @updated_at
      )
    `);
    const insertSetting = database.prepare(`
      INSERT INTO settings (key, value) VALUES (@key, @value)
    `);

    for (const folder of snapshot.folders) {
      insertFolder.run({
        id: folder.id,
        name: folder.name,
        icon: folder.icon ?? 'folder',
        created_at: folder.created_at ?? new Date().toISOString(),
        updated_at: folder.updated_at ?? new Date().toISOString()
      });
    }

    for (const entry of snapshot.entries) {
      insertEntry.run({
        id: entry.id,
        folder_id: entry.folder_id,
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        notes: entry.notes,
        favorite: entry.favorite,
        created_at: entry.created_at,
        updated_at: entry.updated_at
      });
    }

    for (const setting of snapshot.settings) {
      insertSetting.run(setting);
    }
  });

  restore();
}

/**
 * Permanently removes all vault data and settings.
 */
export function deleteAllData(): void {
  const database = getDb();

  const clear = database.transaction(() => {
    database.prepare(`DELETE FROM entries`).run();
    database.prepare(`DELETE FROM folders`).run();
    database.prepare(`DELETE FROM settings`).run();
    database
      .prepare(`DELETE FROM sqlite_sequence WHERE name IN ('entries', 'folders')`)
      .run();
  });

  clear();
}

/**
 * @writes a setting value (INSERT or REPLACE).
 */
export function setSetting(key: string, value: string | number | boolean): void {
  getDb()
    .prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .run(key, String(value));
}

/**
 * @deletes a setting by key.
 */
export function deleteSetting(key: string): void {
  getDb().prepare(`DELETE FROM settings WHERE key = ?`).run(key);
}
