

import { useState, useEffect, useRef } from 'react'
import { Folder, SidebarProps } from '../../../types/types'
import SettingsPanel from './Settings'

const DEFAULT_FOLDER_COLOR = '#7c6dd8'
const COLOR_SWATCHES = ['#7c6dd8', '#38bdf8', '#f59e0b', '#f97316', '#ef4444', '#10b981', '#f43f5e', '#8b5cf6']

export default function Sidebar({
  selectedFolderId,
  onSelectFolder,
  onFoldersChange,
  onSettingsChange,
  theme = 'dark'
}: SidebarProps & { theme?: 'light' | 'dark' | 'darker' | 'midnight' }) {
  const [folders,       setFolders]       = useState<Folder[]>([])
  const [collapsed,     setCollapsed]     = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [ShowSettings,   setShowSettings]   = useState(false)
  const [newName,       setNewName]       = useState('')
  const [newColor,      setNewColor]      = useState(DEFAULT_FOLDER_COLOR)
  const [hoveredId,     setHoveredId]     = useState<number | null | 'all'>('all')
  const [editingId,     setEditingId]     = useState<number | null>(null)
  const [editName,      setEditName]      = useState('')
  const [editColor,     setEditColor]     = useState(DEFAULT_FOLDER_COLOR)
  const [mounted,       setMounted]       = useState(false)
  const [error,         setError]         = useState('')
  const [editError,     setEditError]     = useState('')
  const [deletingId,    setDeletingId]    = useState<number | null>(null)
  const [exportingId,   setExportingId]   = useState<number | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<number | null>(null)
  const newFolderRef                      = useRef<HTMLInputElement>(null)
  const editFolderRef                     = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFolders()
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (editingId !== null) {
      setTimeout(() => editFolderRef.current?.focus(), 30)
    }
  }, [editingId])

  async function loadFolders() {
    try {
      const data = await window.api.getAllFolders()
      setFolders(data)
    } catch (e) {
      console.error('[Sidebar] Failed to load folders:', e)
    }
  }

  function startCreating() {
    setCreating(true)
    setEditingId(null)
    setNewName('')
    setNewColor(DEFAULT_FOLDER_COLOR)
    setError('')
    setTimeout(() => newFolderRef.current?.focus(), 50)
  }

  function openSettings(){
    setShowSettings(true);

  }

  async function submitNewFolder(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) { setError('Name is required.'); return }
    if (trimmed.length > 32) { setError('Max 32 characters.'); return }

    try {
      await window.api.createFolder(trimmed, newColor)
      setCreating(false)
      setNewName('')
      await loadFolders()
      onFoldersChange?.()   
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('UNIQUE')) {
        setError('A folder with that name already exists.')
      } else {
        setError('Could not create folder.')
      }
    }
  }

  function cancelCreating() {
    setCreating(false)
    setNewName('')
    setNewColor(DEFAULT_FOLDER_COLOR)
    setError('')
  }

  function startEditing(folder: Folder, e?: React.MouseEvent) {
    e?.stopPropagation()
    setCreating(false)
    setEditingId(folder.id)
    setEditName(folder.name)
    setEditColor(folder.color || DEFAULT_FOLDER_COLOR)
    setEditError('')
  }

  async function submitEditFolder(e: React.FormEvent) {
    e.preventDefault()
    if (editingId === null) return

    const trimmed = editName.trim()
    if (!trimmed) {
      setEditError('Name is required.')
      return
    }
    if (trimmed.length > 32) {
      setEditError('Max 32 characters.')
      return
    }

    try {
      const res = await window.api.updateFolder(editingId, trimmed, editColor)
      if (!res.success) {
        setEditError('Could not update folder.')
        return
      }

      setEditingId(null)
      setEditName('')
      setEditColor(DEFAULT_FOLDER_COLOR)
      setEditError('')
      await loadFolders()
      onFoldersChange?.()
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('UNIQUE')) {
        setEditError('A folder with that name already exists.')
      } else {
        setEditError('Could not update folder.')
      }
    }
  }

  function cancelEditing() {
    setEditingId(null)
    setEditName('')
    setEditColor(DEFAULT_FOLDER_COLOR)
    setEditError('')
  }

  async function reorderFolders(sourceId: number, targetId: number) {
    if (sourceId === targetId) return

    const sourceIndex = folders.findIndex((folder) => folder.id === sourceId)
    const targetIndex = folders.findIndex((folder) => folder.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return

    const nextFolders = [...folders]
    const [movedFolder] = nextFolders.splice(sourceIndex, 1)
    const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    nextFolders.splice(insertIndex, 0, movedFolder)

    setFolders(nextFolders)

    try {
      await Promise.all(nextFolders.map((folder, index) => window.api.updateFolder(folder.id, folder.name, folder.color || DEFAULT_FOLDER_COLOR, index)))
      await loadFolders()
      onFoldersChange?.()
    } catch (error) {
      console.error('[Sidebar] Failed to reorder folders:', error)
      await loadFolders()
    }
  }

  async function deleteFolder(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await window.api.deleteFolder(id)
      if (selectedFolderId === id) onSelectFolder(null)
      await loadFolders()
      onFoldersChange?.()
    } catch {
      console.error('Failed to delete folder')
    } finally {
      setDeletingId(null)
    }
  }

  async function exportFolder(folder: Folder, e: React.MouseEvent) {
    e.stopPropagation()
    setExportingId(folder.id)
    try {
      await window.api.exportFolderPdf(folder.id)
    } catch (error) {
      console.error('[Sidebar] Failed to export folder:', error)
    } finally {
      setExportingId(null)
    }
  }

  const totalEntries = folders.reduce((sum, f) => sum + f.entry_count, 0)

  return (
    <>
      <style>{STYLES}</style>
          {ShowSettings && (
            <SettingsPanel
              onClose={() => setShowSettings(false)}
              onSettingsSaved={onSettingsChange}
              theme={theme}
            />
          )}

      <aside
        className="sidebar"
        style={{
          width:     collapsed ? '56px' : '220px',
          background: theme === 'light' ? '#f8fafc' : '#111118',
          borderColor: theme === 'light' ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)',
          color: theme === 'light' ? '#18202c' : 'rgba(255,255,255,0.75)',
          minWidth:  collapsed ? '56px' : '220px',
          opacity:   mounted ? 1 : 0,
          transform: mounted ? 'translateX(0)' : 'translateX(-8px)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="sidebar-header">
          {!collapsed && (
            <span className="sidebar-title">Vaults</span>
          )}
          <button
            className="icon-btn collapse-btn"
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* ── All Entries row ─────────────────────────────────────────── */}
        <div
          className={`folder-row ${selectedFolderId === null ? 'selected' : ''}`}
          onClick={() => onSelectFolder(null)}
          onMouseEnter={() => setHoveredId('all')}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span className="folder-icon"><AllIcon /></span>
          {!collapsed && (
            <>
              <span className="folder-name">All Entries</span>
              <span className="entry-count">{totalEntries}</span>
            </>
          )}
          {collapsed && selectedFolderId === null && (
            <span className="active-dot" />
          )}
        </div>

        {!collapsed && (
          <div className="section-label">Folders</div>
        )}
        {collapsed && <div className="collapsed-divider" />}

        <div className="folder-list">
          {folders.length === 0 && !collapsed && !creating && (
            <p className="empty-hint">No folders yet.</p>
          )}

          {folders.map((folder, i) => (
            <div
              key={folder.id}
              className={`folder-row ${selectedFolderId === folder.id ? 'selected' : ''} ${draggedFolderId === folder.id ? 'dragging' : ''}`}
              onClick={() => onSelectFolder(folder.id)}
              onMouseEnter={() => setHoveredId(folder.id)}
              onMouseLeave={() => setHoveredId(null)}
              draggable={!collapsed}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', String(folder.id))
                setDraggedFolderId(folder.id)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                event.preventDefault()
                const sourceId = Number(event.dataTransfer.getData('text/plain')) || draggedFolderId
                if (sourceId && sourceId !== folder.id) {
                  void reorderFolders(sourceId, folder.id)
                }
                setDraggedFolderId(null)
              }}
              onDragEnd={() => setDraggedFolderId(null)}
              style={{
                opacity:   mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 0.3s ease ${0.05 * i + 0.1}s, transform 0.3s ease ${0.05 * i + 0.1}s, background 0.15s`,
              }}
              title={collapsed ? folder.name : `${folder.name} • drag to reorder`}
            >
              <span className="folder-color-swatch" style={{ backgroundColor: folder.color || DEFAULT_FOLDER_COLOR }} />
              <span className="folder-icon"><FolderIcon /></span>

              {!collapsed && (
                <>
                  <span className="folder-name">{folder.name}</span>
                  <span className="folder-row-right">
                    <span className="entry-count">{folder.entry_count}</span>
                    {hoveredId === folder.id && (
                      <>
                        <button
                          className="edit-btn"
                          onClick={(e) => exportFolder(folder, e)}
                          title={`Export ${folder.name} as PDF`}
                          disabled={exportingId === folder.id}
                        >
                          {exportingId === folder.id ? <SpinnerIcon /> : <PrintIcon />}
                        </button>
                        <button
                          className="edit-btn"
                          onClick={(e) => startEditing(folder, e)}
                          title="Edit folder"
                        >
                          <EditIcon />
                        </button>
                        <button
                          className="delete-btn"
                          onClick={(e) => deleteFolder(folder.id, e)}
                          title="Delete folder"
                          disabled={deletingId === folder.id}
                        >
                          {deletingId === folder.id ? <SpinnerIcon /> : <TrashIcon />}
                        </button>
                      </>
                    )}
                  </span>
                </>
              )}

              {collapsed && selectedFolderId === folder.id && (
                <span className="active-dot" />
              )}
            </div>
          ))}

          {creating && !collapsed && (
            <form className="new-folder-form" onSubmit={submitNewFolder}>
              <div className="new-folder-input-row">
                <span className="folder-icon"><FolderIcon /></span>
                <input
                  ref={newFolderRef}
                  className="new-folder-input"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); setError('') }}
                  placeholder="Folder name"
                  maxLength={32}
                  onKeyDown={e => e.key === 'Escape' && cancelCreating()}
                />
              </div>
              {error && <p className="new-folder-error">{error}</p>}
              <div className="color-picker-group">
                <div className="color-swatch-row">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${newColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewColor(color)}
                      title={color}
                    />
                  ))}
                </div>
                <label className="color-picker-label">
                  <span>Custom</span>
                  <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
                </label>
              </div>
              <div className="new-folder-actions">
                <button type="submit" className="new-folder-confirm">Add</button>
                <button type="button" className="new-folder-cancel" onClick={cancelCreating}>Cancel</button>
              </div>
            </form>
          )}

          {editingId !== null && !collapsed && (
            <form className="new-folder-form" onSubmit={submitEditFolder}>
              <div className="new-folder-input-row">
                <span className="folder-icon"><FolderIcon /></span>
                <input
                  ref={editFolderRef}
                  className="new-folder-input"
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setEditError('') }}
                  placeholder="Folder name"
                  maxLength={32}
                  onKeyDown={e => e.key === 'Escape' && cancelEditing()}
                />
              </div>
              {editError && <p className="new-folder-error">{editError}</p>}
              <div className="color-picker-group">
                <div className="color-swatch-row">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch ${editColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditColor(color)}
                      title={color}
                    />
                  ))}
                </div>
                <label className="color-picker-label">
                  <span>Custom</span>
                  <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                </label>
              </div>
              <div className="new-folder-actions">
                <button type="submit" className="new-folder-confirm">Save</button>
                <button type="button" className="new-folder-cancel" onClick={cancelEditing}>Cancel</button>
              </div>
            </form>
          )}
        </div>

        <div className="sidebar-footer">
          <button
            className="new-folder-btn"
            onClick={collapsed ? () => { setCollapsed(false); setTimeout(startCreating, 200) } : startCreating}
            title="New folder"
            disabled={creating}
          >
            <PlusIcon />
            {!collapsed && <span>New Folder</span>}
          </button>
           <button
            className="new-folder-btn"
            onClick={collapsed ? () => { setTimeout(openSettings, 200) } : openSettings}
            title="Settings"
          >
            <SettingsIcon />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>
    </>
  )
}


function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function AllIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500&display=swap');

  .sidebar {
    display:          flex;
    flex-direction:   column;
    height:           100%;
    background:       #111118;
    border-right:     1px solid rgba(255,255,255,0.06);
    transition:       width 0.25s cubic-bezier(0.16,1,0.3,1),
                      min-width 0.25s cubic-bezier(0.16,1,0.3,1),
                      opacity 0.4s ease,
                      transform 0.4s ease;
    overflow:         hidden;
    user-select:      none;
    flex-shrink:      0;
  }

  .sidebar-header {
    display:          flex;
    align-items:      center;
    justify-content:  space-between;
    padding:          20px 12px 12px;
    min-height:       52px;
  }

  .sidebar-title {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    font-weight:      500;
    letter-spacing:   0.1em;
    text-transform:   uppercase;
    color:            inherit;
    opacity:          0.45;
    padding-left:     4px;
    margin-top: 20px;
  }

  .collapse-btn {
    margin-left: auto;
    margin-top: 20px;
  }

  .section-label {
    font-family:      'DM Mono', monospace;
    font-size:        9px;
    font-weight:      500;
    letter-spacing:   0.12em;
    text-transform:   uppercase;
    color:            inherit;
    opacity:          0.32;
    padding:          8px 16px 4px;
  }

  .collapsed-divider {
    width:            28px;
    height:           1px;
    background:       rgba(255,255,255,0.08);
    margin:           8px auto;
  }

  .folder-list {
    flex:             1;
    overflow-y:       auto;
    overflow-x:       hidden;
    padding:          2px 0;
  }

  .folder-list::-webkit-scrollbar { width: 3px; }
  .folder-list::-webkit-scrollbar-track { background: transparent; }
  .folder-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  .folder-row {
    display:          flex;
    align-items:      center;
    gap:              9px;
    padding:          8px 12px;
    cursor:           pointer;
    border-radius:    8px;
    margin:           1px 6px;
    position:         relative;
    transition:       background 0.12s ease, color 0.12s ease;
    color:            inherit;
    opacity:          0.7;
  }

  .folder-row:hover {
    background:       rgba(124,109,216,0.1);
    opacity:          1;
  }

  .folder-row.dragging {
    opacity:          0.6;
    transform:        scale(0.98);
  }

  .folder-row.selected {
    background:       rgba(124,109,216,0.15);
    color:            #7c6dd8;
    opacity:          1;
  }

  .folder-row.selected .entry-count {
    color:            #7c6dd8;
  }

  .folder-color-swatch {
    width:            10px;
    height:           10px;
    border-radius:    50%;
    flex-shrink:      0;
    box-shadow:       inset 0 0 0 1px rgba(255,255,255,0.24);
  }

  .folder-icon {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    flex-shrink:      0;
    width:            18px;
  }

  .folder-name {
    font-family:      'DM Sans', sans-serif;
    font-size:        13px;
    font-weight:      400;
    flex:             1;
    overflow:         hidden;
    text-overflow:    ellipsis;
    white-space:      nowrap;
    letter-spacing:   0.01em;
  }

  .folder-row-right {
    display:          flex;
    align-items:      center;
    gap:              4px;
    margin-left:      auto;
    flex-shrink:      0;
  }

  .entry-count {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    color:            rgba(255,255,255,0.2);
    min-width:        16px;
    text-align:       right;
  }

  .active-dot {
    position:         absolute;
    right:            8px;
    top:              50%;
    transform:        translateY(-50%);
    width:            5px;
    height:           5px;
    border-radius:    50%;
    background:       rgba(168,148,255,0.8);
  }

  .edit-btn {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    background:       none;
    border:           none;
    color:            rgba(124,109,216,0.6);
    cursor:           pointer;
    padding:          2px;
    border-radius:    4px;
    transition:       color 0.15s, background 0.15s;
  }

  .edit-btn:hover {
    color:            #7c6dd8;
    background:       rgba(124,109,216,0.12);
  }

  .delete-btn {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    background:       none;
    border:           none;
    color:            rgba(255,100,100,0.5);
    cursor:           pointer;
    padding:          2px;
    border-radius:    4px;
    transition:       color 0.15s, background 0.15s;
  }

  .delete-btn:hover {
    color:            rgba(255,100,100,0.9);
    background:       rgba(255,100,100,0.1);
  }

  .empty-hint {
    font-family:      'DM Mono', monospace;
    font-size:        11px;
    color:            inherit;
    opacity:          0.45;
    padding:          12px 16px;
    letter-spacing:   0.02em;
  }

  /* ── New folder form ─────────────────────────────────────────── */

  .new-folder-form {
    margin:           2px 6px;
    padding:          8px 8px 10px;
    background:       rgba(124,109,216,0.08);
    border:           1px solid rgba(124,109,216,0.16);
    border-radius:    8px;
  }

  .new-folder-input-row {
    display:          flex;
    align-items:      center;
    gap:              9px;
    color:            #7c6dd8;
  }

  .new-folder-input {
    flex:             1;
    background:       transparent;
    border:           none;
    outline:          none;
    font-family:      'DM Sans', sans-serif;
    font-size:        13px;
    color:            inherit;
    caret-color:      #7c6dd8;
    letter-spacing:   0.01em;
  }

  .new-folder-input::placeholder {
    color:            rgba(15,23,42,0.32);
  }

  .new-folder-error {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    color:            #f87171;
    padding:          4px 0 0 26px;
    letter-spacing:   0.02em;
  }

  .color-picker-group {
    display:          flex;
    align-items:      center;
    gap:              8px;
    padding:          8px 0 0 26px;
    flex-wrap:        wrap;
  }

  .color-swatch-row {
    display:          flex;
    flex-wrap:        wrap;
    gap:              6px;
  }

  .color-swatch {
    width:            18px;
    height:           18px;
    border-radius:    50%;
    border:           2px solid transparent;
    padding:          0;
    cursor:           pointer;
    transition:       transform 0.15s ease, border-color 0.15s ease;
  }

  .color-swatch:hover {
    transform:        scale(1.05);
  }

  .color-swatch.active {
    border-color:     rgba(255,255,255,0.9);
    box-shadow:       0 0 0 1px rgba(15,23,42,0.16);
  }

  .color-picker-label {
    display:          flex;
    align-items:      center;
    gap:              6px;
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    letter-spacing:   0.06em;
    text-transform:   uppercase;
    color:            inherit;
    opacity:          0.8;
  }

  .color-picker-label input[type="color"] {
    width:            22px;
    height:           22px;
    padding:          0;
    border:           none;
    background:       transparent;
    cursor:           pointer;
  }

  .new-folder-actions {
    display:          flex;
    gap:              6px;
    padding-top:      8px;
    padding-left:     26px;
  }

  .new-folder-confirm {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    font-weight:      500;
    letter-spacing:   0.06em;
    text-transform:   uppercase;
    padding:          4px 12px;
    background:       rgba(124,109,216,0.16);
    border:           1px solid rgba(124,109,216,0.24);
    border-radius:    5px;
    color:            #7c6dd8;
    cursor:           pointer;
    transition:       background 0.15s, border-color 0.15s;
  }

  .new-folder-confirm:hover {
    background:       rgba(124,109,216,0.24);
    border-color:     rgba(124,109,216,0.36);
  }

  .new-folder-cancel {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    letter-spacing:   0.06em;
    text-transform:   uppercase;
    padding:          4px 10px;
    background:       rgba(15,23,42,0.04);
    border:           1px solid rgba(15,23,42,0.08);
    border-radius:    5px;
    color:            inherit;
    opacity:          0.75;
    cursor:           pointer;
    transition:       border-color 0.15s, color 0.15s;
  }

  .new-folder-cancel:hover {
    border-color:     rgba(15,23,42,0.16);
    opacity:          1;
  }

  /* ── Footer ──────────────────────────────────────────────────── */

  .sidebar-footer {
    padding:          10px 6px 16px;
    border-top:       1px solid rgba(124,109,216,0.14);
  }

  .new-folder-btn {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    gap:              8px;
    width:            100%;
    padding:          8px 10px;
    background:       rgba(124,109,216,0.08);
    border:           1px dashed rgba(124,109,216,0.16);
    border-radius:    8px;
    color:            inherit;
    font-family:      'DM Sans', sans-serif;
    font-size:        12px;
    cursor:           pointer;
    transition:       border-color 0.15s, color 0.15s, background 0.15s;
    letter-spacing:   0.02em;
  }

  .new-folder-btn:hover:not(:disabled) {
    border-color:     rgba(124,109,216,0.28);
    color:            #7c6dd8;
    background:       rgba(124,109,216,0.14);
  }

  .new-folder-btn:disabled {
    opacity: 0.4;
    cursor:  not-allowed;
  }

  /* ── Icon button base ────────────────────────────────────────── */

  .icon-btn {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    width:            26px;
    height:           26px;
    background:       none;
    border:           none;
    border-radius:    6px;
    color:            rgba(255,255,255,0.25);
    cursor:           pointer;
    transition:       background 0.15s, color 0.15s;
    flex-shrink:      0;
  }

  .icon-btn:hover {
    background:       rgba(255,255,255,0.06);
    color:            rgba(255,255,255,0.6);
  }

  @keyframes sidebar-spin {
    to { transform: rotate(360deg); }
  }

  .sidebar .folder-icon svg {
    animation: none;
  }
`
