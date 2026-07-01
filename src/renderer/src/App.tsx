import { useState, useEffect, useCallback } from 'react'
import UnlockScreen from './components/UnlockScreen'
import Sidebar from './components/Sidebar'
import EntryList from './components/EntryList'
import { Folder } from 'src/types/types'

type AppTheme = 'light' | 'dark' | 'darker' | 'midnight'

export default function App() {
  const [checking,      setChecking]      = useState(true)
  const [locked,        setLocked]        = useState(true)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [theme, setTheme] = useState<AppTheme>('dark')
  useEffect(() => {
    async function init() {
      const first     = await window.api.isFirstLaunch()
      const unlocked  = await window.api.isUnlocked()

      setIsFirstLaunch(first)
      setLocked(first ? true : !unlocked)
      setChecking(false)
    }

    init()
  }, [])

  useEffect(() => {
    let active = true

    async function loadTheme() {
      const savedTheme = await window.api.getSetting('theme')
      if (!active) return
      setTheme((savedTheme as AppTheme) || 'dark')
    }

    loadTheme()
    return () => { active = false }
  }, [settingsVersion])

  useEffect(() => {
    return window.api.onSessionLocked(() => setLocked(true))
  }, [])

   async function loadFolders() {
    const data = await window.api.getAllFolders()
    setFolders(data)
  }

  useEffect(() => {
    if (!locked) loadFolders()
  }, [locked])

  const reportActivity = useCallback(() => {
    window.api.reportActivity()
  }, [])

  useEffect(() => {
    if (locked) return

    let lastReport = 0

    function throttled() {
      const now = Date.now()
      if (now - lastReport > 1000) {
        lastReport = now
        reportActivity()
      }
    }

    window.addEventListener('mousemove',  throttled)
    window.addEventListener('keydown',    throttled)
    window.addEventListener('mousedown',  throttled)
    window.addEventListener('touchstart', throttled)

    return () => {
      window.removeEventListener('mousemove',  throttled)
      window.removeEventListener('keydown',    throttled)
      window.removeEventListener('mousedown',  throttled)
      window.removeEventListener('touchstart', throttled)
    }
  }, [locked, reportActivity])

  if (checking) {
    return <SplashLoader theme={theme} />
  }

  if (locked) {
    return (
      <div>       
        <UnlockScreen
          isFirstLaunch={isFirstLaunch}
          theme={theme}
          onUnlocked={() => {
            setLocked(false)
            setIsFirstLaunch(false)
          }}
        />
      </div>
    )
  }

return (
  <div style={{ ...getThemeStyle(theme), display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
    
    <Sidebar
      selectedFolderId={selectedFolderId}
      theme={theme}
      onSelectFolder={setSelectedFolderId}
      onFoldersChange={loadFolders}   // re-sync when folders are added/deleted
      onSettingsChange={() => setSettingsVersion(version => version + 1)}
    />
    <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <DragBar/>
      <EntryList
        selectedFolderId={selectedFolderId}
        folders={folders}
        settingsVersion={settingsVersion}
        theme={theme}
      />
    </main>
  </div>
)
}
function DragBar() {
  return (
    <div
      style={{
        height:          '28px',
        width:           '100%',
        flexShrink:      0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    />
  )
}

function SplashLoader({ theme }: { theme: AppTheme }) {
  const palette = theme === 'light'
    ? { root: '#f5f6fb', dot: 'rgba(108,80,220,0.65)' }
    : { root: '#0d0d12', dot: 'rgba(168,148,255,0.6)' }

  return (
    <div style={{ ...splashStyles.root, background: palette.root }}>
      <div style={{ ...splashStyles.dot, background: palette.dot }} />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

function getThemeStyle(theme: AppTheme): React.CSSProperties {
  const isLight = theme === 'light'

  return {
    background: isLight ? '#f5f6fb' : '#0d0d12',
    color: isLight ? '#18202c' : '#f0eeff',
    ['--app-bg' as string]: isLight ? '#f5f6fb' : '#0d0d12',
    ['--app-surface' as string]: isLight ? '#ffffff' : '#111118',
    ['--app-surface-strong' as string]: isLight ? '#f8fafc' : '#191924',
    ['--app-text' as string]: isLight ? '#18202c' : '#f0eeff',
    ['--app-text-muted' as string]: isLight ? '#64748b' : 'rgba(255,255,255,0.38)',
    ['--app-border' as string]: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.06)',
    ['--app-accent' as string]: '#7c6dd8',
    ['--app-accent-soft' as string]: isLight ? 'rgba(124,109,216,0.14)' : 'rgba(168,148,255,0.12)',
    ['--app-input-bg' as string]: isLight ? '#f8fafc' : 'rgba(255,255,255,0.05)',
    ['--app-input-text' as string]: isLight ? '#18202c' : '#f0eeff',
    ['--app-input-border' as string]: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
    ['--app-shadow' as string]: isLight ? '0 16px 40px rgba(15, 23, 42, 0.08)' : '0 32px 80px rgba(0,0,0,0.5)',
  } as React.CSSProperties
}

const splashStyles: Record<string, React.CSSProperties> = {
  root: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100vh',
  },
  dot: {
    width:       '8px',
    height:      '8px',
    borderRadius:'50%',
    animation:   'pulse 1.2s ease-in-out infinite',
  },
}
