

import { useState, useEffect, useRef } from 'react'
import { Folder } from '../../../types/types'

interface SidebarProps {
  selectedFolderId: number | null
  onSelectFolder:   (id: number | null) => void
  onFoldersChange?:  () => void   
}

export default function Sidebar({ selectedFolderId, onSelectFolder, onFoldersChange }: SidebarProps) {
  const [folders,       setFolders]       = useState<Folder[]>([])
  const [collapsed,     setCollapsed]     = useState(false)
  const [creating,      setCreating]      = useState(false)
  const [newName,       setNewName]       = useState('')
  const [hoveredId,     setHoveredId]     = useState<number | null | 'all'>('all')
  const [mounted,       setMounted]       = useState(false)
  const [error,         setError]         = useState('')
  const [deletingId,    setDeletingId]    = useState<number | null>(null)
  const newFolderRef                      = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadFolders()
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

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
    setNewName('')
    setError('')
    setTimeout(() => newFolderRef.current?.focus(), 50)
  }

  async function submitNewFolder(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) { setError('Name is required.'); return }
    if (trimmed.length > 32) { setError('Max 32 characters.'); return }

    try {
      await window.api.createFolder(trimmed)
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
    setError('')
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

  const totalEntries = folders.reduce((sum, f) => sum + f.entry_count, 0)

  return (
    <>
      <style>{STYLES}</style>

      <aside
        className="sidebar"
        style={{
          width:     collapsed ? '56px' : '220px',
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
              className={`folder-row ${selectedFolderId === folder.id ? 'selected' : ''}`}
              onClick={() => onSelectFolder(folder.id)}
              onMouseEnter={() => setHoveredId(folder.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                opacity:   mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 0.3s ease ${0.05 * i + 0.1}s, transform 0.3s ease ${0.05 * i + 0.1}s, background 0.15s`,
              }}
              title={collapsed ? folder.name : undefined}
            >
              <span className="folder-icon"><FolderIcon /></span>

              {!collapsed && (
                <>
                  <span className="folder-name">{folder.name}</span>
                  <span className="folder-row-right">
                    <span className="entry-count">{folder.entry_count}</span>
                    {hoveredId === folder.id && (
                      <button
                        className="delete-btn"
                        onClick={(e) => deleteFolder(folder.id, e)}
                        title="Delete folder"
                        disabled={deletingId === folder.id}
                      >
                        {deletingId === folder.id ? <SpinnerIcon /> : <TrashIcon />}
                      </button>
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
              <div className="new-folder-actions">
                <button type="submit" className="new-folder-confirm">Add</button>
                <button type="button" className="new-folder-cancel" onClick={cancelCreating}>Cancel</button>
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

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
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
    color:            rgba(255,255,255,0.25);
    padding-left:     4px;
  }

  .collapse-btn {
    margin-left: auto;
  }

  .section-label {
    font-family:      'DM Mono', monospace;
    font-size:        9px;
    font-weight:      500;
    letter-spacing:   0.12em;
    text-transform:   uppercase;
    color:            rgba(255,255,255,0.18);
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
    color:            rgba(255,255,255,0.45);
  }

  .folder-row:hover {
    background:       rgba(255,255,255,0.05);
    color:            rgba(255,255,255,0.75);
  }

  .folder-row.selected {
    background:       rgba(168,148,255,0.12);
    color:            rgba(168,148,255,0.95);
  }

  .folder-row.selected .entry-count {
    color:            rgba(168,148,255,0.6);
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
    color:            rgba(255,255,255,0.15);
    padding:          12px 16px;
    letter-spacing:   0.02em;
  }

  /* ── New folder form ─────────────────────────────────────────── */

  .new-folder-form {
    margin:           2px 6px;
    padding:          8px 8px 10px;
    background:       rgba(168,148,255,0.07);
    border:           1px solid rgba(168,148,255,0.15);
    border-radius:    8px;
  }

  .new-folder-input-row {
    display:          flex;
    align-items:      center;
    gap:              9px;
    color:            rgba(168,148,255,0.7);
  }

  .new-folder-input {
    flex:             1;
    background:       none;
    border:           none;
    outline:          none;
    font-family:      'DM Sans', sans-serif;
    font-size:        13px;
    color:            rgba(255,255,255,0.85);
    caret-color:      rgba(168,148,255,0.9);
    letter-spacing:   0.01em;
  }

  .new-folder-input::placeholder {
    color:            rgba(255,255,255,0.2);
  }

  .new-folder-error {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    color:            #f87171;
    padding:          4px 0 0 26px;
    letter-spacing:   0.02em;
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
    background:       rgba(168,148,255,0.2);
    border:           1px solid rgba(168,148,255,0.3);
    border-radius:    5px;
    color:            rgba(168,148,255,0.9);
    cursor:           pointer;
    transition:       background 0.15s, border-color 0.15s;
  }

  .new-folder-confirm:hover {
    background:       rgba(168,148,255,0.3);
    border-color:     rgba(168,148,255,0.5);
  }

  .new-folder-cancel {
    font-family:      'DM Mono', monospace;
    font-size:        10px;
    letter-spacing:   0.06em;
    text-transform:   uppercase;
    padding:          4px 10px;
    background:       none;
    border:           1px solid rgba(255,255,255,0.08);
    border-radius:    5px;
    color:            rgba(255,255,255,0.3);
    cursor:           pointer;
    transition:       border-color 0.15s, color 0.15s;
  }

  .new-folder-cancel:hover {
    border-color:     rgba(255,255,255,0.2);
    color:            rgba(255,255,255,0.6);
  }

  /* ── Footer ──────────────────────────────────────────────────── */

  .sidebar-footer {
    padding:          10px 6px 16px;
    border-top:       1px solid rgba(255,255,255,0.05);
  }

  .new-folder-btn {
    display:          flex;
    align-items:      center;
    justify-content:  center;
    gap:              8px;
    width:            100%;
    padding:          8px 10px;
    background:       none;
    border:           1px dashed rgba(255,255,255,0.1);
    border-radius:    8px;
    color:            rgba(255,255,255,0.3);
    font-family:      'DM Sans', sans-serif;
    font-size:        12px;
    cursor:           pointer;
    transition:       border-color 0.15s, color 0.15s, background 0.15s;
    letter-spacing:   0.02em;
  }

  .new-folder-btn:hover:not(:disabled) {
    border-color:     rgba(168,148,255,0.35);
    color:            rgba(168,148,255,0.7);
    background:       rgba(168,148,255,0.05);
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