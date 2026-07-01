

import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { Entry, EntryListProps } from '../../../types/types'
import EntryForm from './EntryForm'

type FaviconCache = Record<string, string | null>

export default function EntryList({ selectedFolderId, folders, settingsVersion = 0 }: EntryListProps) {
  const [entries,      setEntries]      = useState<Entry[]>([])
  const [loading,      setLoading]      = useState(false)
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [copiedId,     setCopiedId]     = useState<number | null>(null)
  const [deletingId,   setDeletingId]   = useState<number | null>(null)
  const [mounted,      setMounted]      = useState(false)
  
  // Password verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyPassword, setVerifyPassword] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [pendingEntry, setPendingEntry] = useState<Entry | null>(null)
  
  // Favicon setting and cache
  const [showFavicons, setShowFavicons] = useState(false)
  const [faviconCache, setFaviconCache] = useState<FaviconCache>({})

  // ── Load entries ────────────────────────────────────────────────────────────

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      let data: Entry[]
      if (search.trim()) {
        data = await window.api.searchEntries(search.trim())
        // filter to current folder if one is selected
        if (selectedFolderId !== null) {
          data = data.filter(e => e.folder_id === selectedFolderId)
        }
      } else if (selectedFolderId === null) {
        data = await window.api.getAllEntries()
      } else {
        data = await window.api.getEntriesByFolder(selectedFolderId)
      }

      const checkBreachesEnabled = (await window.api.getSetting('checkBreaches')) === 'true'
      const enrichedEntries = checkBreachesEnabled
        ? await Promise.all(data.map(async (entry) => {
            try {
              const breach = await window.api.checkPasswordBreach(entry.password)
              return { ...entry, breachCount: breach.count > 0 ? breach.count : 0 }
            } catch (error) {
              console.error('[EntryList] breach check failed:', error)
              return { ...entry, breachCount: 0 }
            }
          }))
        : data.map((entry) => ({ ...entry, breachCount: 0 }))

      setEntries(enrichedEntries)
    } catch (e) {
      console.error('[EntryList] load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedFolderId, search, settingsVersion])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  useEffect(() => {
    (async () => {
      const showFav = await window.api.getSetting('showFavicons')
      setShowFavicons(showFav === 'true')
      setFaviconCache({})
    })()
  }, [settingsVersion])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30)
    return () => clearTimeout(t)
  }, [])

  // ── Actions ─────────────────────────────────────────────────────────────────
  
  async function copyPassword(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation()
    
    // Check if require password on copy is enabled
    const requirePassword = await window.api.getSetting('requirePasswordOnCopy')
    if (requirePassword === 'true') {
      setPendingEntry(entry)
      setShowVerifyModal(true)
      setVerifyPassword('')
      setVerifyError(null)
      return
    }
    
    // If not required, copy directly
    try {
      const plain = await window.api.decryptPassword(entry.password)
      setCopiedId(entry.id)
      setTimeout(() => setCopiedId(null), 2000)
      await window.api.copyWithTimeout(plain)
    } catch (error) {
      console.error('Failed to copy password', error)
    }
  }

  async function handleVerifyAndCopy() {
    if (!pendingEntry) return
    
    setVerifyError(null)
    setVerifyLoading(true)
    
    try {
      // Verify the password with the main process
      const isValid = await window.api.verifyMasterPassword(verifyPassword)
      if (!isValid) {
        setVerifyError('Incorrect master password')
        setVerifyLoading(false)
        return
      }
      
      // Password verified, copy the entry password
      const plain = await window.api.decryptPassword(pendingEntry.password)
      setCopiedId(pendingEntry.id)
      setTimeout(() => setCopiedId(null), 2000)
      await window.api.copyWithTimeout(plain)
      
      // Close modal and reset
      setShowVerifyModal(false)
      setVerifyPassword('')
      setPendingEntry(null)
    } catch (error) {
      console.error('Failed to verify and copy', error)
      setVerifyError('Failed to copy password')
    } finally {
      setVerifyLoading(false)
    }
  }

  async function toggleFavorite(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await window.api.toggleFavorite(entry.id)
      await loadEntries()
    } catch {
      console.error('Failed to toggle favorite')
    }
  }

  async function deleteEntry(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await window.api.deleteEntry(id)
      await loadEntries()
    } catch {
      console.error('Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  function openAdd() {
    setEditingEntry(null)
    setShowForm(true)
  }

  function openEdit(entry: Entry) {
    setEditingEntry(entry)
    setShowForm(true)
  }

  async function handleFormSave() {
    setShowForm(false)
    setEditingEntry(null)
    await loadEntries()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const folderName = selectedFolderId === null
    ? 'All Entries'
    : folders.find(f => f.id === selectedFolderId)?.name ?? 'Folder'

  const getFolderName = (folderId: number) =>
    folders.find(f => f.id === folderId)?.name ?? ''
  

 

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>

      <div className="el-root">

        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div className="el-toolbar" style={{
          opacity:   mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(-6px)',
          transition:'opacity 0.35s ease, transform 0.35s ease',
        }}>
          <div className="el-title-row">
            <h2 className="el-title">{folderName}</h2>
            <span className="el-count">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
          </div>

          <div className="el-toolbar-right">
            {/* Search */}
            <div className="el-search-wrap">
              <span className="el-search-icon"><SearchIcon /></span>
              <input
                className="el-search"
                type="text"
                placeholder="Search entries…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="el-search-clear" onClick={() => setSearch('')}>
                  <XIcon />
                </button>
              )}
            </div>

            {/* Add button */}
            <button className="el-add-btn" onClick={openAdd}>
              <PlusIcon />
              <span>New Entry</span>
            </button>
          </div>
        </div>

        {/* ── Entry grid ───────────────────────────────────────────────── */}
        <div className="el-scroll">
          {loading && entries.length === 0 && (
            <div className="el-empty">
              <div className="el-spinner" />
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div className="el-empty" style={{
              opacity:   mounted ? 1 : 0,
              transition:'opacity 0.4s ease 0.1s',
            }}>
              <div className="el-empty-icon"><LockEmptyIcon /></div>
              <p className="el-empty-title">No entries yet</p>
              <p className="el-empty-sub">
                {search ? 'No results match your search.' : 'Add your first password entry to get started.'}
              </p>
              {!search && (
                <button className="el-empty-btn" onClick={openAdd}>
                  <PlusIcon /> Add Entry
                </button>
              )}
            </div>
          )}

          {entries.length > 0 && (
            <div className="el-grid">
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className="el-card"
                  onClick={() => openEdit(entry)}
                  style={{
                    opacity:   mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(10px)',
                    transition:`opacity 0.3s ease ${i * 0.04}s, transform 0.3s ease ${i * 0.04}s`,
                  }}
                >
                  {/* Avatar or Favicon */}
                  <AvatarDisplay entry={entry} showFavicons={showFavicons} faviconCache={faviconCache} setFaviconCache={setFaviconCache} />

                  {/* Info */}
                  <div className="el-card-info">
                    <p className="el-card-title">{entry.title}</p>
                    <p className="el-card-sub">
                      {entry.username || entry.url || getFolderName(entry.folder_id) || '—'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="el-card-actions" onClick={e => e.stopPropagation()}>

                    {/* Favorite */}
                    <button
                      className={`el-icon-btn ${entry.favorite ? 'el-fav-active' : ''}`}
                      onClick={e => toggleFavorite(entry, e)}
                      title={entry.favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <StarIcon filled={!!entry.favorite} />
                    </button>

                    {/* Copy password */}
                    <button
                      className={`el-icon-btn ${copiedId === entry.id ? 'el-copied' : ''}`}
                      onClick={e => copyPassword(entry, e)}
                      title="Copy password"
                    >
                      {copiedId === entry.id ? <CheckIcon /> : <CopyIcon />}
                    </button>

                    {(entry.breachCount ?? 0) > 0 && (
                      <span className="el-breach-wrapper">
                        <span
                          className="el-breach-indicator"
                          aria-label="Password breach detected"
                        >
                          <AlertTriangleIcon />
                        </span>
                        <span className="el-breach-tooltip" role="tooltip">
                          This password appeared in {entry.breachCount?.toLocaleString()} known data breach{(entry.breachCount ?? 0) === 1 ? '' : 's'}.
                        </span>
                      </span>
                    )}

                    {/* Delete */}
                    <button
                      className="el-icon-btn el-delete-btn"
                      onClick={e => deleteEntry(entry.id, e)}
                      title="Delete entry"
                      disabled={deletingId === entry.id}
                    >
                      {deletingId === entry.id ? <MiniSpinner /> : <TrashIcon />}
                    </button>
                  </div>

                  {/* Folder badge — shown in All Entries view */}
                  {selectedFolderId === null && (
                    <span className="el-folder-badge">
                      <FolderIcon /> {getFolderName(entry.folder_id)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Entry Form Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <EntryForm
          entry={editingEntry}
          folders={folders}
          defaultFolderId={selectedFolderId}
          onSave={handleFormSave}
          onCancel={() => { setShowForm(false); setEditingEntry(null) }}
        />
      )}

      {/* ── Password Verification Modal ──────────────────────────────── */}
      {showVerifyModal && (
        <>
          <div
            className="el-backdrop"
            onClick={() => !verifyLoading && setShowVerifyModal(false)}
          />
          <div className="el-verify-modal">
            <h3 className="el-verify-title">Enter Master Password</h3>
            <p className="el-verify-subtitle">Required to copy password</p>
            
            <input
              type="password"
              className="el-verify-input"
              placeholder="Master password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              disabled={verifyLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !verifyLoading) {
                  handleVerifyAndCopy()
                }
              }}
              autoFocus
            />
            
            {verifyError && (
              <p className="el-verify-error">{verifyError}</p>
            )}
            
            <div className="el-verify-actions">
              <button
                className="el-verify-btn-cancel"
                onClick={() => setShowVerifyModal(false)}
                disabled={verifyLoading}
              >
                Cancel
              </button>
              <button
                className="el-verify-btn-confirm"
                onClick={handleVerifyAndCopy}
                disabled={verifyLoading || !verifyPassword}
              >
                {verifyLoading ? 'Verifying...' : 'Verify & Copy'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ─── Avatar Display Component ─────────────────────────────────────────────────

function AvatarDisplay({ entry, showFavicons, faviconCache, setFaviconCache }: { entry: Entry, showFavicons: boolean, faviconCache: FaviconCache, setFaviconCache: Dispatch<SetStateAction<FaviconCache>> }) {
  const [faviconError, setFaviconError] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!showFavicons || !entry.url) return

    const loadFavicon = async () => {
      try {
        const domain = extractDomain(entry.url || '')
        if (!domain) return

        // Check cache
        if (faviconCache[domain]) {
          setFaviconUrl(faviconCache[domain])
          return
        }

        // Fetch from main process
        const dataUri = await window.api.fetchFavicon(domain)
        if (dataUri) {
          setFaviconCache(prev => ({ ...prev, [domain]: dataUri }))
          setFaviconUrl(dataUri)
        }
      } catch (error) {
        console.error('Failed to load favicon:', error)
        setFaviconError(true)
      }
    }

    loadFavicon()
  }, [entry.url, showFavicons, faviconCache, setFaviconCache])

  if (showFavicons && faviconUrl && !faviconError) {
    return (
      <img
        src={faviconUrl}
        alt={entry.title}
        className="el-favicon"
        onError={() => setFaviconError(true)}
      />
    )
  }

  return (
    <div className="el-avatar" style={{ background: avatarColor(entry.title) }}>
      {entry.title.charAt(0).toUpperCase()}
    </div>
  )
}

function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#5c6bc0', '#7b59c0', '#8e44ad', '#2980b9',
  '#16a085', '#27ae60', '#d35400', '#c0392b',
  '#1a6b8a', '#6d4c41',
]

function avatarColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) hash = title.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
}
function XIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function CopyIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
}
function CheckIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function AlertTriangleIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
}
function StarIcon({ filled }: { filled: boolean }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function FolderIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
}
function LockEmptyIcon() {
  return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function MiniSpinner() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'el-spin 0.7s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/></svg>
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');

  .el-root {
    display:        flex;
    flex-direction: column;
    height:         100%;
    overflow:       hidden;
    background:     #0f0f16;
  }

  /* ── Toolbar ──────────────────────────────────────────────────── */

  .el-toolbar {
    padding:        24px 28px 16px;
    border-bottom:  1px solid rgba(255,255,255,0.05);
    flex-shrink:    0;
  }

  .el-title-row {
    display:        flex;
    align-items:    baseline;
    gap:            12px;
    margin-bottom:  16px;
  }

  .el-title {
    font-family:    'DM Serif Display', serif;
    font-size:      22px;
    font-weight:    400;
    color:          #f0eeff;
    letter-spacing: -0.02em;
    margin:         0;
  }

  .el-count {
    font-family:    'DM Mono', monospace;
    font-size:      11px;
    color:          rgba(255,255,255,0.2);
    letter-spacing: 0.04em;
  }

  .el-toolbar-right {
    display:        flex;
    align-items:    center;
    gap:            10px;
  }

  /* ── Search ───────────────────────────────────────────────────── */

  .el-search-wrap {
    position:       relative;
    flex:           1;
    display:        flex;
    align-items:    center;
  }

  .el-search-icon {
    position:       absolute;
    left:           11px;
    color:          rgba(255,255,255,0.25);
    display:        flex;
    pointer-events: none;
  }

  .el-search {
    width:          100%;
    padding:        9px 32px 9px 34px;
    background:     rgba(255,255,255,0.04);
    border:         1px solid rgba(255,255,255,0.07);
    border-radius:  9px;
    color:          rgba(255,255,255,0.8);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    outline:        none;
    transition:     border-color 0.2s, background 0.2s;
    letter-spacing: 0.01em;
  }

  .el-search::placeholder { color: rgba(255,255,255,0.2); }
  .el-search:focus {
    border-color:   rgba(168,148,255,0.4);
    background:     rgba(255,255,255,0.06);
  }

  .el-search-clear {
    position:       absolute;
    right:          10px;
    background:     none;
    border:         none;
    color:          rgba(255,255,255,0.3);
    cursor:         pointer;
    display:        flex;
    padding:        2px;
    border-radius:  4px;
    transition:     color 0.15s;
  }
  .el-search-clear:hover { color: rgba(255,255,255,0.7); }

  /* ── Add button ───────────────────────────────────────────────── */

  .el-add-btn {
    display:        flex;
    align-items:    center;
    gap:            7px;
    padding:        9px 16px;
    background:     linear-gradient(135deg, rgba(168,148,255,0.85), rgba(108,80,220,0.85));
    border:         none;
    border-radius:  9px;
    color:          #fff;
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    font-weight:    500;
    cursor:         pointer;
    white-space:    nowrap;
    transition:     opacity 0.2s, transform 0.15s;
    box-shadow:     0 2px 12px rgba(108,80,220,0.3);
    letter-spacing: 0.01em;
  }

  .el-add-btn:hover {
    opacity:    0.9;
    transform:  translateY(-1px);
  }

  .el-add-btn:active { transform: translateY(0); }

  /* ── Scroll area ──────────────────────────────────────────────── */

  .el-scroll {
    flex:           1;
    overflow-y:     auto;
    padding:        20px 28px 28px;
  }

  .el-scroll::-webkit-scrollbar { width: 4px; }
  .el-scroll::-webkit-scrollbar-track { background: transparent; }
  .el-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

  /* ── Empty state ──────────────────────────────────────────────── */

  .el-empty {
    display:        flex;
    flex-direction: column;
    align-items:    center;
    justify-content:center;
    height:         100%;
    min-height:     300px;
    gap:            12px;
    color:          rgba(255,255,255,0.2);
  }

  .el-empty-icon {
    width:          64px;
    height:         64px;
    border-radius:  18px;
    background:     rgba(255,255,255,0.04);
    border:         1px solid rgba(255,255,255,0.06);
    display:        flex;
    align-items:    center;
    justify-content:center;
    margin-bottom:  4px;
  }

  .el-empty-title {
    font-family:    'DM Serif Display', serif;
    font-size:      18px;
    font-weight:    400;
    color:          rgba(255,255,255,0.3);
    margin:         0;
    letter-spacing: -0.01em;
  }

  .el-empty-sub {
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    color:          rgba(255,255,255,0.18);
    margin:         0;
    text-align:     center;
    max-width:      260px;
    line-height:    1.6;
  }

  .el-empty-btn {
    display:        flex;
    align-items:    center;
    gap:            6px;
    margin-top:     8px;
    padding:        9px 18px;
    background:     rgba(168,148,255,0.1);
    border:         1px solid rgba(168,148,255,0.2);
    border-radius:  9px;
    color:          rgba(168,148,255,0.8);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    cursor:         pointer;
    transition:     background 0.15s, border-color 0.15s;
  }

  .el-empty-btn:hover {
    background:     rgba(168,148,255,0.18);
    border-color:   rgba(168,148,255,0.35);
  }

  .el-spinner {
    width:          20px;
    height:         20px;
    border:         2px solid rgba(255,255,255,0.1);
    border-top-color: rgba(168,148,255,0.6);
    border-radius:  50%;
    animation:      el-spin 0.7s linear infinite;
  }

  /* ── Entry grid ───────────────────────────────────────────────── */

  .el-grid {
    display:        flex;
    flex-direction: column;
    gap:            6px;
  }

  /* ── Entry card ───────────────────────────────────────────────── */

  .el-card {
    display:        flex;
    align-items:    center;
    gap:            14px;
    padding:        14px 16px;
    background:     rgba(255,255,255,0.03);
    border:         1px solid rgba(255,255,255,0.06);
    border-radius:  12px;
    cursor:         pointer;
    position:       relative;
    transition:     background 0.15s, border-color 0.15s, transform 0.15s;
  }

  .el-card:hover {
    background:     rgba(255,255,255,0.055);
    border-color:   rgba(168,148,255,0.2);
    transform:      translateX(2px);
  }

  /* ── Avatar ───────────────────────────────────────────────────── */

  .el-avatar {
    width:          40px;
    height:         40px;
    border-radius:  11px;
    display:        flex;
    align-items:    center;
    justify-content:center;
    font-family:    'DM Serif Display', serif;
    font-size:      17px;
    color:          rgba(255,255,255,0.9);
    flex-shrink:    0;
    letter-spacing: -0.01em;
  }

  /* ── Favicon ───────────────────────────────────────────────────── */

  .el-favicon {
    width:          40px;
    height:         40px;
    border-radius:  11px;
    flex-shrink:    0;
    display:        block;
    object-fit:     contain;
    background:     rgba(255,255,255,0.02);
    padding:        4px;
    box-sizing:     border-box;
  }

  /* ── Card info ────────────────────────────────────────────────── */

  .el-card-info {
    flex:           1;
    overflow:       hidden;
    min-width:      0;
  }

  .el-card-title {
    font-family:    'DM Sans', sans-serif;
    font-size:      14px;
    font-weight:    500;
    color:          rgba(255,255,255,0.85);
    margin:         0 0 3px;
    white-space:    nowrap;
    overflow:       hidden;
    text-overflow:  ellipsis;
    letter-spacing: 0.01em;
  }

  .el-card-sub {
    font-family:    'DM Mono', monospace;
    font-size:      11px;
    color:          rgba(255,255,255,0.28);
    margin:         0;
    white-space:    nowrap;
    overflow:       hidden;
    text-overflow:  ellipsis;
    letter-spacing: 0.02em;
  }

  /* ── Card actions ─────────────────────────────────────────────── */

  .el-card-actions {
    display:        flex;
    align-items:    center;
    gap:            4px;
    opacity:        0;
    transition:     opacity 0.15s;
    flex-shrink:    0;
  }

  .el-card:hover .el-card-actions { opacity: 1; }

  .el-icon-btn {
    display:        flex;
    align-items:    center;
    justify-content:center;
    width:          30px;
    height:         30px;
    background:     none;
    border:         none;
    border-radius:  7px;
    color:          rgba(255,255,255,0.3);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
    flex-shrink:    0;
  }

  .el-icon-btn:hover {
    background:     rgba(255,255,255,0.07);
    color:          rgba(255,255,255,0.75);
  }

  .el-fav-active {
    color:          #f59e0b !important;
  }

  .el-fav-active:hover {
    background:     rgba(245,158,11,0.1) !important;
    color:          #f59e0b !important;
  }

  .el-copied {
    color:          #4ade80 !important;
    background:     rgba(74,222,128,0.1) !important;
  }

  .el-delete-btn:hover {
    background:     rgba(248,113,113,0.1) !important;
    color:          #f87171 !important;
  }

  .el-breach-wrapper {
    position:       relative;
    display:        inline-flex;
    align-items:    center;
    justify-content:center;
  }

  .el-breach-indicator {
    display:        inline-flex;
    align-items:    center;
    justify-content:center;
    width:          28px;
    height:         28px;
    border-radius:  7px;
    color:          #f87171;
    background:     rgba(248,113,113,0.1);
    flex-shrink:    0;
    cursor:         help;
  }

  .el-breach-indicator:hover {
    background:     rgba(248,113,113,0.16);
  }

  .el-breach-tooltip {
    position:       absolute;
    right:          0;
    bottom:         calc(100% + 8px);
    padding:        8px 10px;
    border-radius:  8px;
    background:     rgba(17, 24, 39, 0.96);
    color:          #fef2f2;
    font-family:    'DM Sans', sans-serif;
    font-size:      11px;
    line-height:    1.4;
    white-space:    nowrap;
    box-shadow:     0 10px 24px rgba(0,0,0,0.28);
    border:         1px solid rgba(248,113,113,0.2);
    opacity:        0;
    pointer-events: none;
    transform:      translateY(4px);
    transition:     opacity 0.15s ease, transform 0.15s ease;
    z-index:        20;
  }

  .el-breach-wrapper:hover .el-breach-tooltip {
    opacity:        1;
    transform:      translateY(0);
  }

  /* ── Folder badge ─────────────────────────────────────────────── */

  .el-folder-badge {
    position:       absolute;
    bottom:         8px;
    right:          54px;
    display:        flex;
    align-items:    center;
    gap:            4px;
    font-family:    'DM Mono', monospace;
    font-size:      9px;
    color:          rgba(255,255,255,0.18);
    letter-spacing: 0.04em;
    pointer-events: none;
  }

  @keyframes el-spin { to { transform: rotate(360deg); } }

  /* ── Verification Modal ───────────────────────────────────────── */

  .el-backdrop {
    position:       fixed;
    inset:          0;
    background:     rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index:        200;
    animation:      el-backdrop-in 0.2s ease;
  }

  @keyframes el-backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .el-verify-modal {
    position:       fixed;
    top:            50%;
    left:           50%;
    transform:      translate(-50%, -50%);
    width:          100%;
    max-width:      340px;
    padding:        28px 24px;
    background:     linear-gradient(135deg, rgba(22,22,31,0.95), rgba(14,14,20,0.95));
    border:         1px solid rgba(168,148,255,0.15);
    border-radius:  16px;
    box-shadow:     0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
    z-index:        201;
    animation:      el-modal-in 0.3s cubic-bezier(0.16,1,0.3,1);
  }

  @keyframes el-modal-in {
    from {
      opacity:      0;
      transform:    translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity:      1;
      transform:    translate(-50%, -50%) scale(1);
    }
  }

  .el-verify-title {
    font-family:    'DM Serif Display', serif;
    font-size:      18px;
    font-weight:    400;
    color:          #f0eeff;
    margin:         0 0 6px;
    letter-spacing: -0.02em;
  }

  .el-verify-subtitle {
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    color:          rgba(255,255,255,0.35);
    margin:         0 0 16px;
    letter-spacing: 0.01em;
  }

  .el-verify-input {
    width:          100%;
    padding:        11px 14px;
    margin-bottom:  12px;
    background:     rgba(255,255,255,0.04);
    border:         1px solid rgba(255,255,255,0.08);
    border-radius:  10px;
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    color:          rgba(255,255,255,0.85);
    box-sizing:     border-box;
    transition:     border-color 0.15s, background 0.15s;
  }

  .el-verify-input:focus {
    outline:        none;
    background:     rgba(255,255,255,0.06);
    border-color:   rgba(168,148,255,0.3);
  }

  .el-verify-input::placeholder {
    color:          rgba(255,255,255,0.2);
  }

  .el-verify-input:disabled {
    opacity:        0.5;
    cursor:         not-allowed;
  }

  .el-verify-error {
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    color:          #f87171;
    margin:         0 0 12px;
    padding:        8px 10px;
    background:     rgba(248,113,113,0.08);
    border:         1px solid rgba(248,113,113,0.2);
    border-radius:  8px;
    line-height:    1.4;
  }

  .el-verify-actions {
    display:        flex;
    gap:            10px;
  }

  .el-verify-btn-cancel {
    flex:           1;
    padding:        10px;
    background:     rgba(255,255,255,0.04);
    border:         1px solid rgba(255,255,255,0.08);
    border-radius:  9px;
    color:          rgba(255,255,255,0.45);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .el-verify-btn-cancel:hover:not(:disabled) {
    background:     rgba(255,255,255,0.07);
    color:          rgba(255,255,255,0.7);
  }

  .el-verify-btn-cancel:disabled {
    opacity:        0.5;
    cursor:         not-allowed;
  }

  .el-verify-btn-confirm {
    flex:           1;
    padding:        10px;
    background:     linear-gradient(135deg, rgba(168,148,255,0.9), rgba(108,80,220,0.9));
    border:         none;
    border-radius:  9px;
    color:          #fff;
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    font-weight:    500;
    cursor:         pointer;
    transition:     opacity 0.15s, transform 0.15s;
    box-shadow:     0 2px 8px rgba(108,80,220,0.3);
  }

  .el-verify-btn-confirm:hover:not(:disabled) {
    opacity:        0.9;
    transform:      translateY(-1px);
  }

  .el-verify-btn-confirm:disabled {
    opacity:        0.5;
    cursor:         not-allowed;
  }
`
