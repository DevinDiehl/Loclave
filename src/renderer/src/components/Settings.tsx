import { useState, useEffect } from 'react'

const AUTO_LOCK_DURATION_MS = {
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  '30min': 1_800_000,
  'never': 2_592_000_000
} as const;
type AutoLockDuration = keyof typeof AUTO_LOCK_DURATION_MS;

const MS_TO_AUTO_LOCK_DURATION: Record<string, AutoLockDuration> = {
  60_000: '1min',
  300_000: '5min',
  900_000: '15min',
  1_800_000: '30min',
  2_592_000_000: 'never'
} as const;

const CLIPBOARD_TIMEOUT_MS = {
  '10s': 10_000,
  '30s': 30_000,
  '60s': 60_000,
  'never': 2_592_000_000,
} as const;

type ClipboardTimeout = keyof typeof CLIPBOARD_TIMEOUT_MS;
const MS_TO_CLIPBOARD_TIMEOUT: Record<string, ClipboardTimeout> = {
  10_000: '10s',
  30_000: '30s',
  60_000: '60s',
  2_592_000_000: 'never'
};

type Theme = 'light' | 'dark' | 'darker' | 'midnight'

interface SettingsProps {
  onClose: () => void
  onSettingsSaved?: () => void
  theme?: 'light' | 'dark' | 'darker' | 'midnight'
}

export default function SettingsPanel({ onClose, onSettingsSaved, theme: selectedTheme = 'dark' }: SettingsProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'security' | 'appearance' | 'general'>('security')
  
  // Password change modal
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null)
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)
  const [deleteAllDataLoading, setDeleteAllDataLoading] = useState(false)
  const [deleteAllDataError, setDeleteAllDataError] = useState<string | null>(null)

  // Security settings
  const [autoLock, setAutoLock] = useState<AutoLockDuration>('5min')
  const [clipboardTimeout, setClipboardTimeout] = useState<ClipboardTimeout>('30s')
  const [requirePasswordOnCopy, setRequirePasswordOnCopy] = useState(false)

  // Appearance settings
  const [theme, setTheme] = useState<Theme>('dark')
  const isLightTheme = selectedTheme === 'light'
  const themeVars = {
    '--sp-modal-bg': isLightTheme ? '#ffffff' : '#16161f',
    '--sp-surface': isLightTheme ? '#f8fafc' : 'rgba(255,255,255,0.02)',
    '--sp-surface-strong': isLightTheme ? '#f3f4f6' : 'rgba(255,255,255,0.03)',
    '--sp-text': isLightTheme ? '#18202c' : '#f0eeff',
    '--sp-text-muted': isLightTheme ? '#475569' : 'rgba(255,255,255,0.6)',
    '--sp-text-soft': isLightTheme ? '#64748b' : 'rgba(255,255,255,0.28)',
    '--sp-text-faint': isLightTheme ? '#94a3b8' : 'rgba(255,255,255,0.2)',
    '--sp-border': isLightTheme ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.06)',
    '--sp-border-strong': isLightTheme ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.09)',
    '--sp-hover': isLightTheme ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    '--sp-input-bg': isLightTheme ? '#ffffff' : 'rgba(255,255,255,0.04)',
    '--sp-input-border': isLightTheme ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.08)',
    '--sp-input-text': isLightTheme ? '#111827' : '#f0eeff',
    '--sp-input-placeholder': isLightTheme ? '#64748b' : 'rgba(255,255,255,0.2)',
    '--sp-accent': '#7c6dd8',
    '--sp-accent-soft': isLightTheme ? 'rgba(124,109,216,0.12)' : 'rgba(168,148,255,0.12)',
    '--sp-shadow': isLightTheme ? '0 30px 80px rgba(15,23,42,0.12)' : '0 40px 100px rgba(0,0,0,0.6)',
    colorScheme: isLightTheme ? 'light' : 'dark',
  } as React.CSSProperties
  const [showFavicons, setShowFavicons] = useState(true)

  // General settings
  const [startOnLogin, setStartOnLogin] = useState(false)
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [checkBreaches, setCheckBreaches] = useState(true)
  const [exportingVault, setExportingVault] = useState(false)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [importingVault, setImportingVault] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importingChrome, setImportingChrome] = useState(false)
  const [showBackupPasswordModal, setShowBackupPasswordModal] = useState(false)
  const [backupPasswordAction, setBackupPasswordAction] = useState<'export' | 'import' | null>(null)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupPasswordError, setBackupPasswordError] = useState<string | null>(null)
  const [backupPasswordLoading, setBackupPasswordLoading] = useState(false)

  useEffect(() => {
    (async () => {
      setAutoLock(MS_TO_AUTO_LOCK_DURATION[String(await window.api.getSetting('lock_timeout_ms')) as keyof typeof MS_TO_AUTO_LOCK_DURATION] || '5min');
      setClipboardTimeout(MS_TO_CLIPBOARD_TIMEOUT[String(await window.api.getSetting('clipboardTimeout')) as keyof typeof MS_TO_CLIPBOARD_TIMEOUT] || '30s');
      setRequirePasswordOnCopy(await window.api.getSetting('requirePasswordOnCopy') === 'true');
      setTheme((await window.api.getSetting('theme')) as Theme || 'dark');
      setShowFavicons(await window.api.getSetting('showFavicons') === 'true');
      setStartOnLogin(await window.api.getSetting('startOnLogin') === 'true');
      setMinimizeToTray(await window.api.getSetting('minimizeToTray') === 'true');
    })();


    const t = setTimeout(() => setMounted(true), 20)
    return () => clearTimeout(t)
  }, [])

  async function saveSettings() {
    await window.api.setLockTimeout(AUTO_LOCK_DURATION_MS[autoLock]);
    await window.api.saveClipboardTimeout(CLIPBOARD_TIMEOUT_MS[clipboardTimeout]);
    await window.api.saveRequirePasswordOnCopy(requirePasswordOnCopy);
    await window.api.saveTheme(theme);
    await window.api.saveShowFavicons(showFavicons);
    await window.api.saveStartOnLogin(startOnLogin);
    await window.api.saveMinimizeToTray(minimizeToTray);
    await window.api.saveCheckBreaches(checkBreaches);
    onSettingsSaved?.();
    onClose();
  }

  async function handleChangePassword() {
    setPasswordChangeError(null)
    
    // Validation
    if (!currentPassword) {
      setPasswordChangeError('Please enter your current password')
      return
    }
    if (!newPassword) {
      setPasswordChangeError('Please enter a new password')
      return
    }
    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordChangeError('New password must be different from current password')
      return
    }

    try {
      setPasswordChangeLoading(true)
      await window.api.changeMasterPassword(currentPassword, newPassword)
      
      // Success - clear form and close modal
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowChangePasswordModal(false)
      setPasswordChangeError(null)
    } catch (err) {
      setPasswordChangeError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPasswordChangeLoading(false)
    }
  }

  async function handleImportVault() {
    setImportMessage(null)
    setImportError(null)
    setBackupPassword('')
    setBackupPasswordError(null)
    setBackupPasswordAction('import')
    setShowBackupPasswordModal(true)
  }

  async function handleImportChrome() {
    setImportMessage(null)
    setImportError(null)
    try {
      setImportingChrome(true)
      const result = await window.api.importChromeCsv()
      if (result.canceled) setImportMessage('Chrome import cancelled.')
      else {
        setImportMessage(`Imported ${result.entryCount ?? 0} passwords from Chrome.`)
        setTimeout(() => window.location.reload(), 800)
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import Chrome passwords')
    } finally {
      setImportingChrome(false)
    }
  }

  async function handleExportVault() {
    setExportMessage(null)
    setExportError(null)
    setBackupPassword('')
    setBackupPasswordError(null)
    setBackupPasswordAction('export')
    setShowBackupPasswordModal(true)
  }

  async function executeBackupAction() {
    if (!backupPassword) {
      setBackupPasswordError('Please enter your master password')
      return
    }

    setBackupPasswordError(null)
    setBackupPasswordLoading(true)
    if (backupPasswordAction === 'export') {
      setExportingVault(true)
    } else if (backupPasswordAction === 'import') {
      setImportingVault(true)
    }

    try {
      if (backupPasswordAction === 'export') {
        const result = await window.api.exportVault(backupPassword)
        if (result.canceled) {
          setExportMessage('Export cancelled.')
        } else {
          setExportMessage('Encrypted backup exported successfully.')
        }
      } else if (backupPasswordAction === 'import') {
        const result = await window.api.importVault(backupPassword)
        if (result.canceled) {
          setImportMessage('Import cancelled.')
        } else {
          setImportMessage(`Restored ${result.entryCount ?? 0} entries from backup.`)
          setTimeout(() => window.location.reload(), 800)
        }
      }

      setShowBackupPasswordModal(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete backup action'
      if (backupPasswordAction === 'export') {
        setExportError(message)
      } else {
        setImportError(message)
      }
    } finally {
      setBackupPasswordLoading(false)
      setBackupPasswordAction(null)
      setExportingVault(false)
      setImportingVault(false)
    }
  }

  async function handleDeleteAllData() {
    setDeleteAllDataError(null)

    try {
      setDeleteAllDataLoading(true)
      const result = await window.api.deleteAllData()

      if (result.canceled) {
        setDeleteAllDataLoading(false)
      }
    } catch (err) {
      setDeleteAllDataError(err instanceof Error ? err.message : 'Failed to delete all data')
      setDeleteAllDataLoading(false)
    }
  }


  return (
    <div style={themeVars}>
      <style>{STYLES}</style>

      {/* Backdrop */}
      <div
        className="sp-backdrop"
        style={{ opacity: mounted ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="sp-modal"
        style={{
          opacity: mounted ? 1 : 0,
          transform: `translate(-50%, -50%) ${mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)'}`,
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header-left">
            <SettingsIcon />
            <h2 className="sp-title">Settings</h2>
          </div>
          <button className="sp-close" onClick={onClose} title="Close">
            <XIcon />
          </button>
        </div>

        {/* Tabs */}
        <div className="sp-tabs">
          {(['security', 'appearance', 'general'] as const).map(tab => (
            <button
              key={tab}
              className={`sp-tab ${activeTab === tab ? 'sp-tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sp-scroll">

          {/* ── Security ── */}
          {activeTab === 'security' && (
            <div className="sp-section-group">
              <Section title="Auto-Lock">
                <SegmentedControl
                  options={[
                    { label: '1m', value: '1min' },
                    { label: '5m', value: '5min' },
                    { label: '15m', value: '15min' },
                    { label: '30m', value: '30min' },
                    { label: 'Never', value: 'never' },
                  ]}
                  value={autoLock}
                  onChange={v => setAutoLock(v as AutoLockDuration)}
                />
                <p className="sp-hint">Automatically lock the vault after a period of inactivity.</p>
              </Section>

              <Section title="Clipboard Timeout">
                <SegmentedControl
                  options={[
                    { label: '10s', value: '10s' },
                    { label: '30s', value: '30s' },
                    { label: '60s', value: '60s' },
                    { label: 'Never', value: 'never' },
                  ]}
                  value={clipboardTimeout}
                  onChange={v => setClipboardTimeout(v as ClipboardTimeout)}
                />
                <p className="sp-hint">Clear copied passwords from clipboard automatically.</p>
              </Section>

              <Section title="Behaviour">
                <Toggle
                  label="Require unlock to copy password"
                  checked={requirePasswordOnCopy}
                  onChange={setRequirePasswordOnCopy}
                />
              </Section>

              <div className="sp-danger-zone">
                <p className="sp-danger-label">Danger Zone</p>
                <button className="sp-danger-btn" onClick={() => setShowChangePasswordModal(true)}>
                  <LockIcon /> Change Master Password
                </button>
                <button
                  className="sp-danger-btn sp-danger-btn-red"
                  onClick={handleDeleteAllData}
                  disabled={deleteAllDataLoading}
                >
                  <TrashIcon /> {deleteAllDataLoading ? 'Deleting...' : 'Delete All Data'}
                </button>
                {deleteAllDataError && (
                  <p className="sp-status sp-status-error">{deleteAllDataError}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Appearance ── */}
          {activeTab === 'appearance' && (
            <div className="sp-section-group">
              <Section title="Theme">
                <div className="sp-theme-grid">
                  {([
                    { value: 'light', label: 'Light', bg: '#f7f8fc', accent: '#7c6dd8' },
                    { value: 'dark', label: 'Dark', bg: '#16161f', accent: '#a894ff' },
                 
                  ] as const).map(t => (
                    <button
                      key={t.value}
                      className={`sp-theme-swatch ${theme === t.value ? 'sp-theme-swatch-active' : ''}`}
                      onClick={() => setTheme(t.value)}
                      style={{ '--swatch-bg': t.bg, '--swatch-accent': t.accent } as React.CSSProperties}
                    >
                      <div className="sp-swatch-preview">
                        <div className="sp-swatch-bar" />
                        <div className="sp-swatch-bar sp-swatch-bar-short" />
                        <div className="sp-swatch-dot" />
                      </div>
                      <span className="sp-swatch-label">{t.label}</span>
                      {theme === t.value && <div className="sp-swatch-check"><CheckIcon /></div>}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="Layout">
                <Toggle
                  label="Show website favicons"
                  description="Load icons from external URLs"
                  checked={showFavicons}
                  onChange={setShowFavicons}
                />
              </Section>
            </div>
          )}

          {/* ── General ── */}
          {activeTab === 'general' && (
            <div className="sp-section-group">
              <Section title="Application">
                <Toggle
                  label="Launch on system startup"
                  checked={startOnLogin}
                  onChange={setStartOnLogin}
                />
                <Toggle
                  label="Minimize to system tray"
                  checked={minimizeToTray}
                  onChange={setMinimizeToTray}
                />
              </Section>

              <Section title="Privacy">
                <Toggle
                  label="Check for data breaches"
                  description="Uses HaveIBeenPwned to alert you of compromised passwords"
                  checked={checkBreaches}
                  onChange={setCheckBreaches}
                />
              </Section>

              <Section title="Data">
                <div className="sp-action-row">
                  <div>
                    <p className="sp-action-label">Export Vault</p>
                    <p className="sp-hint" style={{ marginTop: 2 }}>Download an encrypted backup of your data.</p>
                    {exportMessage && <p className="sp-status sp-status-success">{exportMessage}</p>}
                    {exportError && <p className="sp-status sp-status-error">{exportError}</p>}
                  </div>
                  <button
                    className="sp-action-btn"
                    onClick={handleExportVault}
                    disabled={exportingVault || backupPasswordLoading}
                  >
                    <ExportIcon /> {exportingVault ? 'Exporting...' : 'Export'}
                  </button>
                </div>
                <div className="sp-action-row">
                  <div>
                    <p className="sp-action-label">Import from Chrome</p>
                    <p className="sp-hint" style={{ marginTop: 2 }}>Add passwords from Chrome&apos;s exported CSV file.</p>
                  </div>
                  <button className="sp-action-btn" onClick={handleImportChrome} disabled={importingChrome}>
                    <ImportIcon /> {importingChrome ? 'Importing...' : 'Import CSV'}
                  </button>
                </div>
                <div className="sp-action-row">
                  <div>
                    <p className="sp-action-label">Import Backup</p>
                    <p className="sp-hint" style={{ marginTop: 2 }}>Restore from an encrypted vault backup.</p>
                    {importMessage && <p className="sp-status sp-status-success">{importMessage}</p>}
                    {importError && <p className="sp-status sp-status-error">{importError}</p>}
                  </div>
                  <button
                    className="sp-action-btn"
                    onClick={handleImportVault}
                    disabled={importingVault || backupPasswordLoading}
                  >
                    <ImportIcon /> {importingVault ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </Section>

              <div className="sp-about">
                <p className="sp-about-name">Vault</p>
                <p className="sp-about-version">Version 1.0.0</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sp-footer">
          <button className="sp-cancel-btn" onClick={async () => {
            await saveSettings();
          }}
          >Discard</button>
          <button className="sp-save-btn" onClick={saveSettings}>Save Changes</button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <>
          <div
            className="sp-backdrop"
            style={{ opacity: 1 }}
            onClick={() => !passwordChangeLoading && setShowChangePasswordModal(false)}
          />
          <div
            className="sp-modal cp-modal"
            style={{
              opacity: 1,
              transform: 'translate(-50%, -50%) translateY(0) scale(1)',
              background: 'var(--sp-modal-bg)',
              color: 'var(--sp-text)',
            }}
          >
            <div className="sp-header">
              <div className="sp-header-left">
                <LockIcon />
                <h2 className="sp-title">Change Master Password</h2>
              </div>
              <button
                className="sp-close"
                onClick={() => !passwordChangeLoading && setShowChangePasswordModal(false)}
                disabled={passwordChangeLoading}
                title="Close"
              >
                <XIcon />
              </button>
            </div>

            <div className="sp-scroll cp-scroll">
              <div className="cp-form">
                <div className="cp-form-group">
                  <label className="cp-label">Current Master Password</label>
                  <input
                    type="password"
                    className="cp-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={passwordChangeLoading}
                  />
                </div>

                <div className="cp-form-group">
                  <label className="cp-label">New Master Password</label>
                  <input
                    type="password"
                    className="cp-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (minimum 8 characters)"
                    disabled={passwordChangeLoading}
                  />
                </div>

                <div className="cp-form-group">
                  <label className="cp-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="cp-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    disabled={passwordChangeLoading}
                  />
                </div>

                {passwordChangeError && (
                  <div className="cp-error">
                    {passwordChangeError}
                  </div>
                )}

                <p className="cp-hint">
                  ⚠️ Your master password cannot be recovered if forgotten. All your passwords are encrypted with this password.
                </p>
              </div>
            </div>

            <div className="sp-footer">
              <button
                className="sp-cancel-btn"
                onClick={() => setShowChangePasswordModal(false)}
                disabled={passwordChangeLoading}
              >
                Cancel
              </button>
              <button
                className="sp-save-btn"
                onClick={handleChangePassword}
                disabled={passwordChangeLoading}
              >
                {passwordChangeLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </>
      )}

      {showBackupPasswordModal && (
        <>
          <div
            className="sp-backdrop"
            style={{ opacity: 1 }}
            onClick={() => !backupPasswordLoading && setShowBackupPasswordModal(false)}
          />
          <div
            className="sp-modal cp-modal"
            style={{
              opacity: 1,
              transform: 'translate(-50%, -50%) translateY(0) scale(1)',
              background: 'var(--sp-modal-bg)',
              color: 'var(--sp-text)',
            }}
          >
            <div className="sp-header">
              <div className="sp-header-left">
                <LockIcon />
                <h2 className="sp-title">
                  {backupPasswordAction === 'export' ? 'Export Vault Backup' : 'Import Vault Backup'}
                </h2>
              </div>
              <button
                className="sp-close"
                onClick={() => !backupPasswordLoading && setShowBackupPasswordModal(false)}
                disabled={backupPasswordLoading}
                title="Close"
              >
                <XIcon />
              </button>
            </div>

            <div className="sp-scroll cp-scroll">
              <div className="cp-form">
                <div className="cp-form-group">
                  <label className="cp-label">Master Password</label>
                  <input
                    type="password"
                    className="cp-input"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    placeholder="Enter master password"
                    disabled={backupPasswordLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !backupPasswordLoading) {
                        executeBackupAction()
                      }
                    }}
                    autoFocus
                  />
                </div>

                {backupPasswordError && (
                  <div className="cp-error">
                    {backupPasswordError}
                  </div>
                )}

                <p className="cp-hint">
                  This backup is encrypted using your master password and can only be restored with the same password.
                </p>
              </div>
            </div>

            <div className="sp-footer">
              <button
                className="sp-cancel-btn"
                onClick={() => setShowBackupPasswordModal(false)}
                disabled={backupPasswordLoading}
              >
                Cancel
              </button>
              <button
                className="sp-save-btn"
                onClick={executeBackupAction}
                disabled={backupPasswordLoading || !backupPassword}
              >
                {backupPasswordLoading ? (backupPasswordAction === 'export' ? 'Exporting...' : 'Importing...') : (backupPasswordAction === 'export' ? 'Continue' : 'Continue')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sp-section">
      <p className="sp-section-title">{title}</p>
      <div className="sp-section-body">{children}</div>
    </div>
  )
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="sp-toggle-row">
      <div className="sp-toggle-text">
        <span className="sp-toggle-label">{label}</span>
        {description && <span className="sp-toggle-desc">{description}</span>}
      </div>
      <div
        className={`sp-toggle ${checked ? 'sp-toggle-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <div className="sp-toggle-thumb" />
      </div>
    </label>
  )
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="sp-segmented">
      {options.map(o => (
        <button
          key={o.value}
          className={`sp-seg-btn ${value === o.value ? 'sp-seg-btn-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}
function SettingsIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
}
function LockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
}
function ExportIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
}
function ImportIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
}
function CheckIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  .sp-backdrop {
    position:   fixed;
    inset:      0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    z-index:    100;
    transition: opacity 0.25s ease;
  }

  .sp-modal {
    position:       fixed;
    top:            50%;
    left:           50%;
    transform:      translate(-50%, -50%);
    width:          100%;
    max-width:      500px;
    max-height:     90vh;
    background:     var(--sp-modal-bg);
    border:         1px solid var(--sp-border-strong);
    border-radius:  18px;
    z-index:        101;
    display:        flex;
    flex-direction: column;
    box-shadow:     var(--sp-shadow), inset 0 1px 0 rgba(255,255,255,0.05);
    overflow:       hidden;
  }

  /* ── Header ───────────────────────────────────────────────────── */

  .sp-header {
    display:        flex;
    align-items:    center;
    justify-content:space-between;
    padding:        24px 24px 0;
    flex-shrink:    0;
  }

  .sp-header-left {
    display:        flex;
    align-items:    center;
    gap:            9px;
    color:          var(--sp-accent);
  }

  .sp-title {
    font-family:    'DM Serif Display', serif;
    font-size:      20px;
    font-weight:    400;
    color:          var(--sp-text);
    margin:         0;
    letter-spacing: -0.02em;
  }

  .sp-close {
    display:        flex;
    align-items:    center;
    justify-content:center;
    width:          32px;
    height:         32px;
    background:     var(--sp-surface-strong);
    border:         none;
    border-radius:  8px;
    color:          var(--sp-text-muted);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .sp-close:hover {
    background:     var(--sp-hover);
    color:          var(--sp-text);
  }

  /* ── Tabs ─────────────────────────────────────────────────────── */

  .sp-tabs {
    display:        flex;
    gap:            2px;
    padding:        16px 24px 0;
    flex-shrink:    0;
  }

  .sp-tab {
    padding:        7px 14px;
    background:     none;
    border:         none;
    border-radius:  8px;
    font-family:    'DM Mono', monospace;
    font-size:      11px;
    font-weight:    500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color:          var(--sp-text-soft);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .sp-tab:hover {
    background:     var(--sp-hover);
    color:          var(--sp-text-muted);
  }

  .sp-tab-active {
    background:     var(--sp-accent-soft) !important;
    color:          var(--sp-accent) !important;
  }

  /* ── Scroll ───────────────────────────────────────────────────── */

  .sp-scroll {
    flex:           1;
    overflow-y:     auto;
    padding:        16px 24px;
  }

  .sp-scroll::-webkit-scrollbar { width: 3px; }
  .sp-scroll::-webkit-scrollbar-track { background: transparent; }
  .sp-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

  /* ── Section group ────────────────────────────────────────────── */

  .sp-section-group {
    display:        flex;
    flex-direction: column;
    gap:            6px;
  }

  .sp-section {
    background:     var(--sp-surface);
    border:         1px solid var(--sp-border);
    border-radius:  12px;
    overflow:       hidden;
  }

  .sp-section-title {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    font-weight:    500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color:          var(--sp-text-faint);
    margin:         0;
    padding:        12px 14px 8px;
    border-bottom:  1px solid rgba(255,255,255,0.04);
  }

  .sp-section-body {
    display:        flex;
    flex-direction: column;
    gap:            1px;
    padding:        10px 14px 12px;
  }

  .sp-hint {
    font-family:    'DM Sans', sans-serif;
    font-size:      11px;
    color:          var(--sp-text-soft);
    margin:         6px 0 0;
    line-height:    1.5;
  }

  .sp-status {
    font-family:    'DM Sans', sans-serif;
    font-size:      11px;
    margin:         6px 0 0;
    line-height:    1.4;
  }

  .sp-status-success {
    color:          rgba(134,239,172,0.72);
  }

  .sp-status-error {
    color:          rgba(248,113,113,0.82);
  }

  /* ── Segmented control ────────────────────────────────────────── */

  .sp-segmented {
    display:        flex;
    background:     var(--sp-surface-strong);
    border-radius:  8px;
    padding:        3px;
    gap:            2px;
  }

  .sp-seg-btn {
    flex:           1;
    padding:        6px 4px;
    background:     none;
    border:         none;
    border-radius:  6px;
    font-family:    'DM Mono', monospace;
    font-size:      11px;
    font-weight:    500;
    color:          var(--sp-text-soft);
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
    letter-spacing: 0.03em;
  }

  .sp-seg-btn:hover {
    color:          var(--sp-text-muted);
  }

  .sp-seg-btn-active {
    background:     var(--sp-accent-soft) !important;
    color:          var(--sp-accent) !important;
  }

  /* ── Toggle ───────────────────────────────────────────────────── */

  .sp-toggle-row {
    display:        flex;
    align-items:    center;
    justify-content:space-between;
    gap:            16px;
    padding:        8px 0;
    cursor:         pointer;
    border-bottom:  1px solid rgba(255,255,255,0.03);
  }

  .sp-toggle-row:last-child {
    border-bottom:  none;
    padding-bottom: 0;
  }

  .sp-toggle-row:first-child {
    padding-top:    0;
  }

  .sp-toggle-text {
    display:        flex;
    flex-direction: column;
    gap:            3px;
  }

  .sp-toggle-label {
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    color:          var(--sp-text);
    letter-spacing: 0.01em;
  }

  .sp-toggle-desc {
    font-family:    'DM Sans', sans-serif;
    font-size:      11px;
    color:          var(--sp-text-soft);
    line-height:    1.4;
  }

  .sp-toggle {
    flex-shrink:    0;
    width:          36px;
    height:         20px;
    background:     var(--sp-hover);
    border-radius:  10px;
    position:       relative;
    transition:     background 0.2s;
    cursor:         pointer;
  }

  .sp-toggle-on {
    background:     var(--sp-accent) !important;
  }

  .sp-toggle-thumb {
    position:       absolute;
    top:            3px;
    left:           3px;
    width:          14px;
    height:         14px;
    background:     #fff;
    border-radius:  50%;
    transition:     transform 0.2s cubic-bezier(0.16,1,0.3,1);
    box-shadow:     0 1px 4px rgba(0,0,0,0.3);
  }

  .sp-toggle-on .sp-toggle-thumb {
    transform:      translateX(16px);
  }

  /* ── Theme swatches ───────────────────────────────────────────── */

  .sp-theme-grid {
    display:        grid;
    grid-template-columns: repeat(3, 1fr);
    gap:            8px;
  }

  .sp-theme-swatch {
    position:       relative;
    display:        flex;
    flex-direction: column;
    align-items:    center;
    gap:            8px;
    padding:        12px 10px 10px;
    background:     var(--sp-surface-strong);
    border:         1px solid var(--sp-border);
    border-radius:  10px;
    cursor:         pointer;
    transition:     border-color 0.15s, background 0.15s;
  }

  .sp-theme-swatch:hover {
    background:     var(--sp-hover);
    border-color:   var(--sp-border-strong);
  }

  .sp-theme-swatch-active {
    border-color:   var(--sp-accent) !important;
    background:     var(--sp-accent-soft) !important;
  }

  .sp-swatch-preview {
    width:          100%;
    height:         44px;
    background:     var(--swatch-bg);
    border-radius:  6px;
    padding:        8px;
    box-sizing:     border-box;
    display:        flex;
    flex-direction: column;
    gap:            5px;
    border:         1px solid rgba(255,255,255,0.06);
  }

  .sp-swatch-bar {
    height:         4px;
    background:     var(--swatch-accent);
    border-radius:  2px;
    opacity:        0.7;
    width:          100%;
  }

  .sp-swatch-bar-short {
    width:          60%;
    opacity:        0.3;
    background:     rgba(255,255,255,0.3);
  }

  .sp-swatch-dot {
    width:          8px;
    height:         8px;
    background:     var(--swatch-accent);
    border-radius:  50%;
    margin-top:     auto;
    opacity:        0.8;
  }

  .sp-swatch-label {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    font-weight:    500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color:          var(--sp-text-faint);
  }

  .sp-swatch-check {
    position:       absolute;
    top:            7px;
    right:          7px;
    width:          16px;
    height:         16px;
    background:     var(--sp-accent);
    border-radius:  50%;
    display:        flex;
    align-items:    center;
    justify-content:center;
    color:          #fff;
  }

  /* ── Danger zone ──────────────────────────────────────────────── */

  .sp-danger-zone {
    background:     var(--sp-surface-strong);
    border:         1px solid rgba(248,113,113,0.16);
    border-radius:  12px;
    padding:        14px;
    display:        flex;
    flex-direction: column;
    gap:            8px;
  }

  .sp-danger-label {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    font-weight:    500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color:          rgba(248,113,113,0.7);
    margin:         0 0 2px;
  }

  .sp-danger-btn {
    display:        flex;
    align-items:    center;
    gap:            8px;
    padding:        9px 12px;
    background:     var(--sp-modal-bg);
    border:         1px solid rgba(248,113,113,0.2);
    border-radius:  8px;
    color:          var(--sp-text);
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s, border-color 0.15s;
    letter-spacing: 0.01em;
    text-align:     left;
  }

  .sp-danger-btn:hover {
    background:     rgba(248,113,113,0.08);
    color:          var(--sp-text);
  }

  .sp-danger-btn:disabled {
    opacity:        0.55;
    cursor:         not-allowed;
  }

  .sp-danger-btn-red {
    color:          rgba(220,38,38,0.95) !important;
    border-color:   rgba(220,38,38,0.28) !important;
    font-weight:    600;
  }

  .sp-danger-btn-red:hover {
    background:     rgba(248,113,113,0.14) !important;
    color:          rgba(185,28,28,1) !important;
  }

  /* ── Action rows ──────────────────────────────────────────────── */

  .sp-action-row {
    display:        flex;
    align-items:    center;
    justify-content:space-between;
    gap:            16px;
    padding:        8px 0;
    border-bottom:  1px solid rgba(255,255,255,0.03);
  }

  .sp-action-row:last-child {
    border-bottom:  none;
    padding-bottom: 0;
  }

  .sp-action-row:first-child {
    padding-top:    0;
  }

  .sp-action-label {
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    color:          rgba(255,255,255,0.75);
    margin:         0;
    letter-spacing: 0.01em;
  }

  .sp-action-btn {
    flex-shrink:    0;
    display:        flex;
    align-items:    center;
    gap:            6px;
    padding:        7px 12px;
    background:     var(--sp-surface-strong);
    border:         1px solid var(--sp-border);
    border-radius:  8px;
    color:          var(--sp-text-muted);
    font-family:    'DM Mono', monospace;
    font-size:      11px;
    font-weight:    500;
    letter-spacing: 0.04em;
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
  }

  .sp-action-btn:hover {
    background:     var(--sp-hover);
    color:          var(--sp-text);
  }

  .sp-action-btn:disabled {
    opacity:        0.55;
    cursor:         not-allowed;
    transform:      none;
  }

  /* ── About ────────────────────────────────────────────────────── */

  .sp-about {
    display:        flex;
    align-items:    center;
    justify-content:space-between;
    padding:        10px 14px;
    background:     rgba(255,255,255,0.02);
    border:         1px solid rgba(255,255,255,0.05);
    border-radius:  12px;
  }

  .sp-about-name {
    font-family:    'DM Serif Display', serif;
    font-size:      14px;
    color:          rgba(255,255,255,0.4);
    margin:         0;
    letter-spacing: -0.01em;
  }

  .sp-about-version {
    font-family:    'DM Mono', monospace;
    font-size:      10px;
    color:          rgba(255,255,255,0.2);
    margin:         0;
    letter-spacing: 0.06em;
  }

  /* ── Footer ───────────────────────────────────────────────────── */

  .sp-footer {
    display:        flex;
    gap:            10px;
    padding:        16px 24px 24px;
    border-top:     1px solid rgba(255,255,255,0.06);
    flex-shrink:    0;
  }

  .sp-cancel-btn {
    flex:           1;
    padding:        11px;
    background:     var(--sp-surface-strong);
    border:         1px solid var(--sp-border);
    border-radius:  9px;
    color:          var(--sp-text-muted);
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    cursor:         pointer;
    transition:     background 0.15s, color 0.15s;
    letter-spacing: 0.01em;
  }

  .sp-cancel-btn:hover {
    background:     var(--sp-hover);
    color:          var(--sp-text);
  }

  .sp-save-btn {
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
    height:         42px;
    transition:     opacity 0.2s, transform 0.15s;
    box-shadow:     0 2px 12px rgba(108,80,220,0.3);
    letter-spacing: 0.01em;
  }

  .sp-save-btn:hover {
    opacity:        0.9;
    transform:      translateY(-1px);
  }

  /* ── Change Password Modal ────────────────────────────────────── */

  .cp-modal {
    max-width:      440px;
  }

  .cp-scroll {
    padding:        24px !important;
  }

  .cp-form {
    display:        flex;
    flex-direction: column;
    gap:            16px;
  }

  .cp-form-group {
    display:        flex;
    flex-direction: column;
    gap:            6px;
  }

  .cp-label {
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    font-weight:    500;
    color:          var(--sp-text-muted);
    letter-spacing: 0.01em;
  }

  .cp-input {
    padding:        10px 12px;
    background:     var(--sp-input-bg);
    border:         1px solid var(--sp-input-border);
    border-radius:  8px;
    font-family:    'DM Sans', sans-serif;
    font-size:      13px;
    color:          var(--sp-input-text);
    transition:     border-color 0.15s, background 0.15s;
  }

  .cp-input::placeholder {
    color:          var(--sp-input-placeholder);
  }

  .cp-input:focus {
    outline:        none;
    background:     var(--sp-surface-strong);
    border-color:   var(--sp-accent);
  }

  .cp-input:disabled {
    opacity:        0.5;
    cursor:         not-allowed;
  }

  .cp-error {
    padding:        10px 12px;
    background:     rgba(248,113,113,0.08);
    border:         1px solid rgba(248,113,113,0.2);
    border-radius:  8px;
    font-family:    'DM Sans', sans-serif;
    font-size:      12px;
    color:          rgba(248,113,113,0.8);
    line-height:    1.4;
    margin-top:     4px;
  }

  .cp-hint {
    font-family:    'DM Sans', sans-serif;
    font-size:      11px;
    color:          var(--sp-text-soft);
    line-height:    1.5;
    margin:         8px 0 0;
  }
`
