

import { useState, useEffect, useRef } from 'react'
import type { EntryFormProps} from '../../../types/types'

export default function EntryForm({
  entry,
  folders,
  defaultFolderId,
  onSave,
  onCancel,
}: EntryFormProps) {
  const isEditing = entry !== null

  const [title,        setTitle]        = useState(entry?.title        ?? '')
  const [username,     setUsername]     = useState(entry?.username     ?? '')
  const [password,     setPassword]     = useState('')
  const [url,          setUrl]          = useState(entry?.url          ?? '')
  const [notes,        setNotes]        = useState(entry?.notes        ?? '')
  const [folderId,     setFolderId]     = useState<number | null>(
    entry?.folder_id ?? defaultFolderId ?? (folders[0]?.id ?? null)
  )
  const [showPassword, setShowPassword] = useState(false)
  const [strength,     setStrength]     = useState(0)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [saving,       setSaving]       = useState(false)
  const [mounted,      setMounted]      = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20)
    titleRef.current?.focus()
    return () => clearTimeout(t)
  }, [])

  // Load decrypted password when editing
  useEffect(() => {
    if (!entry) return
    async function loadPassword() {
      try {
        const plain = await window.api.decryptPassword(entry!.password, entry!.id)
        setPassword(plain)
      } catch {
        setPassword('')
      }
    }
    loadPassword()
  }, [entry])

  // Password strength
  useEffect(() => {
    setStrength(calcStrength(password))
  }, [password])

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!title.trim())    e.title    = 'Title is required.'
    if (!password)        e.password = 'Password is required.'
    if (folderId === null) e.folder  = 'Select a folder.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)

    try {
      if (isEditing && entry) {
        await window.api.updateEntry({
          id:       entry.id,
          folderId: folderId!,
          title:    title.trim(),
          username: username.trim(),
          password,
          url:      url.trim() || null,
          notes:    notes.trim() || null,
          favorite: entry.favorite,
        })
      } else {
        await window.api.createEntry({
          folderId: folderId!,
          title:    title.trim(),
          username: username.trim(),
          password,
          url:      url.trim() || null,
          notes:    notes.trim() || null,
        })
      }

      onSave()
    } catch (err) {
      console.error('[EntryForm] save failed:', err)
      setErrors({ submit: 'Failed to save entry. Please try again.' })
      setSaving(false)
    }
  }

  // ── Generate password ───────────────────────────────────────────────────────

  function generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
    const arr   = new Uint8Array(20)
    crypto.getRandomValues(arr)
    setPassword(Array.from(arr).map(b => chars[b % chars.length]).join(''))
    setErrors(prev => ({ ...prev, password: '' }))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{STYLES}</style>

      {/* Backdrop */}
      <div
        className="ef-backdrop"
        style={{ opacity: mounted ? 1 : 0 }}
        onClick={onCancel}
      />

      {/* Modal */}
     <div
        className="ef-modal"
        style={{
            opacity:   mounted ? 1 : 0,
            transform: `translate(-50%, -50%) ${mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)'}`,
            transition:'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
    >
        {/* Header */}
        <div className="ef-header">
          <h2 className="ef-title">{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
          <button className="ef-close" onClick={onCancel} title="Close">
            <XIcon />
          </button>
        </div>

        {/* Form */}
        <form className="ef-form" onSubmit={handleSubmit}>
          <div className="ef-scroll">

            {/* Title */}
            <Field label="Title" error={errors.title} required>
              <input
                ref={titleRef}
                className={`ef-input ${errors.title ? 'ef-input-error' : ''}`}
                value={title}
                onChange={e => { setTitle(e.target.value); clearErr('title') }}
                placeholder="e.g. GitHub, Netflix, Bank"
                maxLength={80}
              />
            </Field>

            {/* Folder */}
            <Field label="Folder" error={errors.folder} required>
              <select
                className={`ef-select ${errors.folder ? 'ef-input-error' : ''}`}
                value={folderId ?? ''}
                onChange={e => { setFolderId(Number(e.target.value)); clearErr('folder') }}
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </Field>

            {/* Username */}
            <Field label="Username / Email">
              <input
                className="ef-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username or email"
                autoComplete="off"
              />
            </Field>

            {/* Password */}
            <Field label="Password" error={errors.password} required>
              <div className="ef-password-wrap">
                <input
                  className={`ef-input ef-password-input ${errors.password ? 'ef-input-error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); clearErr('password') }}
                  placeholder="••••••••••••"
                  autoComplete="new-password"
                />
                <div className="ef-password-btns">
                  <button type="button" className="ef-pw-btn" onClick={() => setShowPassword(v => !v)} title={showPassword ? 'Hide' : 'Show'}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                  <button type="button" className="ef-pw-btn ef-gen-btn" onClick={generatePassword} title="Generate password">
                    <RefreshIcon />
                  </button>
                </div>
              </div>

              {/* Strength bar */}
              {password && (
                <div className="ef-strength-wrap">
                  <div className="ef-strength-bar">
                    {[1, 2, 3, 4].map(n => (
                      <div
                        key={n}
                        className="ef-strength-seg"
                        style={{ background: n <= strength ? strengthColor(strength) : 'rgba(255,255,255,0.08)' }}
                      />
                    ))}
                  </div>
                  <span className="ef-strength-label" style={{ color: strengthColor(strength) }}>
                    {strengthLabel(strength)}
                  </span>
                </div>
              )}
            </Field>

            {/* URL */}
            <Field label="Website URL">
              <input
                className="ef-input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                type="url"
              />
            </Field>

            {/* Notes */}
            <Field label="Notes">
              <textarea
                className="ef-textarea"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes…"
                rows={3}
                maxLength={500}
              />
            </Field>

            {/* Submit error */}
            {errors.submit && (
              <p className="ef-submit-error">{errors.submit}</p>
            )}
          </div>

          {/* Footer */}
          <div className="ef-footer">
            <button type="button" className="ef-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ef-save-btn" disabled={saving}>
              {saving
                ? <span className="ef-spinner" />
                : isEditing ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </>
  )

  function clearErr(key: string) {
    setErrors(prev => ({ ...prev, [key]: '' }))
  }
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, error, required, children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="ef-field">
      <label className="ef-label">
        {label}
        {required && <span className="ef-required">*</span>}
      </label>
      {children}
      {error && <p className="ef-field-error">{error}</p>}
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────

function calcStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8)                    score++
  if (pw.length >= 14)                   score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

function strengthLabel(s: number) {
  return ['', 'Weak', 'Fair', 'Good', 'Strong'][s]
}

function strengthColor(s: number) {
  return ['', '#f87171', '#fb923c', '#facc15', '#4ade80'][s]
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}
function EyeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
function RefreshIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  .ef-backdrop {
    position:   fixed;
    inset:      0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index:    100;
    transition: opacity 0.25s ease;
  }

  .ef-modal {
    position:       fixed;
    top:            50%;
    left:           50%;
    transform:      translate(-50%, -50%);
    width:          100%;
    max-width:      480px;
    max-height:     90vh;
    background:     #16161f;
    border:         1px solid rgba(255,255,255,0.08);
    border-radius:  18px;
    z-index:        101;
    display:        flex;
    flex-direction: column;
    box-shadow:     0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
    overflow:       hidden;
  }

  .ef-header {
    display:        flex;
    align-items:    center;
    justify-content:space-between;
    padding:        24px 24px 0;
    flex-shrink:    0;
  }

  .ef-title {
    font-family:    'DM Serif Display', serif;
    font-size:      20px;
    font-weight:    400;
    color:          #f0eeff;
    margin:         0;
    letter-spacing: -0.02em;
  }

  .ef-close {
    display:        flex;
    align-items:    center;
    justify-content:center;
    width:          32px;
    height:         32px;
    background:     rgba(255,255,255,0.05);
    border:         none;
    border-radius:  8px;
    color:          rgba(255,255,255,0.4);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .ef-close:hover {
    background:     rgba(255,255,255,0.1);
    color:          rgba(255,255,255,0.8);
  }

  .ef-form {
    display:        flex;
    flex-direction: column;
    flex:           1;
    overflow:       hidden;
  }

  .ef-scroll {
    flex:           1;
    overflow-y:     auto;
    padding:        20px 24px;
    display:        flex;
    flex-direction: column;
    gap:            16px;
  }

  .ef-scroll::-webkit-scrollbar { width: 3px; }
  .ef-scroll::-webkit-scrollbar-track { background: transparent; }
  .ef-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  /* ── Fields ───────────────────────────────────────────────────── */

  .ef-field {
    display:        flex;
    flex-direction: column;
    gap:            7px;
  }

  .ef-label {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    font-weight:    500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color:          rgba(255,255,255,0.35);
  }

  .ef-required {
    color:          rgba(168,148,255,0.7);
    margin-left:    3px;
  }

  .ef-input, .ef-select, .ef-textarea {
    width:          100%;
    padding:        10px 13px;
    background:     rgba(255,255,255,0.05);
    border:         1px solid rgba(255,255,255,0.08);
    border-radius:  9px;
    color:          rgba(255,255,255,0.85);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    outline:        none;
    transition:     border-color 0.2s, background 0.2s;
    letter-spacing: 0.01em;
    box-sizing:     border-box;
  }

  .ef-input::placeholder, .ef-textarea::placeholder {
    color:          rgba(255,255,255,0.2);
  }

  .ef-input:focus, .ef-select:focus, .ef-textarea:focus {
    border-color:   rgba(168,148,255,0.45);
    background:     rgba(255,255,255,0.07);
  }

  .ef-input-error {
    border-color:   rgba(248,113,113,0.5) !important;
  }

  .ef-select {
    appearance:     none;
    cursor:         pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right:  36px;
  }

  .ef-select option {
    background:     #16161f;
    color:          rgba(255,255,255,0.85);
  }

  .ef-textarea {
    resize:         vertical;
    min-height:     80px;
    line-height:    1.6;
  }

  /* ── Password field ───────────────────────────────────────────── */

  .ef-password-wrap {
    position:       relative;
    display:        flex;
    align-items:    center;
  }

  .ef-password-input {
    padding-right:  76px !important;
  }

  .ef-password-btns {
    position:       absolute;
    right:          6px;
    display:        flex;
    gap:            2px;
  }

  .ef-pw-btn {
    display:        flex;
    align-items:    center;
    justify-content:center;
    width:          28px;
    height:         28px;
    background:     none;
    border:         none;
    border-radius:  6px;
    color:          rgba(255,255,255,0.3);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .ef-pw-btn:hover {
    background:     rgba(255,255,255,0.08);
    color:          rgba(255,255,255,0.7);
  }

  .ef-gen-btn:hover {
    background:     rgba(168,148,255,0.1) !important;
    color:          rgba(168,148,255,0.8) !important;
  }

  /* ── Strength bar ─────────────────────────────────────────────── */

  .ef-strength-wrap {
    display:        flex;
    align-items:    center;
    gap:            10px;
    margin-top:     6px;
  }

  .ef-strength-bar {
    display:        flex;
    gap:            4px;
    flex:           1;
  }

  .ef-strength-seg {
    height:         3px;
    flex:           1;
    border-radius:  2px;
    transition:     background 0.3s;
  }

  .ef-strength-label {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    font-weight:    500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    min-width:      44px;
    text-align:     right;
    transition:     color 0.3s;
  }

  /* ── Errors ───────────────────────────────────────────────────── */

  .ef-field-error {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    color:          #f87171;
    margin:         0;
    letter-spacing: 0.02em;
  }

  .ef-submit-error {
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    color:          #f87171;
    background:     rgba(248,113,113,0.08);
    border:         1px solid rgba(248,113,113,0.2);
    border-radius:  8px;
    padding:        10px 12px;
    margin:         0;
  }

  /* ── Footer ───────────────────────────────────────────────────── */

  .ef-footer {
    display:        flex;
    gap:            10px;
    padding:        16px 24px 24px;
    border-top:     1px solid rgba(255,255,255,0.06);
    flex-shrink:    0;
  }

  .ef-cancel-btn {
    flex:           1;
    padding:        11px;
    background:     rgba(255,255,255,0.04);
    border:         1px solid rgba(255,255,255,0.08);
    border-radius:  9px;
    color:          rgba(255,255,255,0.45);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
    letter-spacing: 0.01em;
  }

  .ef-cancel-btn:hover {
    background:     rgba(255,255,255,0.07);
    color:          rgba(255,255,255,0.7);
  }

  .ef-save-btn {
    flex:           2;
    padding:        11px;
    background:     linear-gradient(135deg, rgba(168,148,255,0.9), rgba(108,80,220,0.9));
    border:         none;
    border-radius:  9px;
    color:          #fff;
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    font-weight:    500;
    cursor:         pointer;
    display:        flex;
    align-items:    center;
    justify-content:center;
    height:         42px;
    transition:     opacity 0.2s, transform 0.15s;
    box-shadow:     0 2px 12px rgba(108,80,220,0.3);
    letter-spacing: 0.01em;
  }

  .ef-save-btn:hover:not(:disabled) {
    opacity:        0.9;
    transform:      translateY(-1px);
  }

  .ef-save-btn:disabled {
    opacity:        0.6;
    cursor:         not-allowed;
  }

  .ef-spinner {
    display:        inline-block;
    width:          16px;
    height:         16px;
    border:         2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius:  50%;
    animation:      el-spin 0.7s linear infinite;
  }
`
