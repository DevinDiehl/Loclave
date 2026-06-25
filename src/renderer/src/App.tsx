import { useState, useEffect, useCallback } from 'react'
import UnlockScreen from './components/UnlockScreen'
import Sidebar from './components/Sidebar'
import EntryList from './components/EntryList'
import { Folder } from 'src/types/types'

export default function App() {
  const [checking,      setChecking]      = useState(true)
  const [locked,        setLocked]        = useState(true)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [settingsVersion, setSettingsVersion] = useState(0)
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
    return <SplashLoader />
  }

  if (locked) {
    return (
      <div>       
        <UnlockScreen
          isFirstLaunch={isFirstLaunch}
          onUnlocked={() => {
            setLocked(false)
            setIsFirstLaunch(false)
          }}
        />
      </div>
    )
  }

return (
  <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#0d0d12', overflow: 'hidden' }}>
    
    <Sidebar
      selectedFolderId={selectedFolderId}
      onSelectFolder={setSelectedFolderId}
      onFoldersChange={loadFolders}   // re-sync when folders are added/deleted
      onSettingsChange={() => setSettingsVersion(version => version + 1)}
    />
    <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <DragBar/>
      <EntryList
        selectedFolderId={selectedFolderId}
        folders={folders}
        settingsVersion={settingsVersion}
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

function SplashLoader() {
  return (
    <div style={splashStyles.root}>
      <div style={splashStyles.dot} />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }
      `}</style>
    </div>
  )
}

const splashStyles: Record<string, React.CSSProperties> = {
  root: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100vh',
    background:     '#0d0d12',
  },
  dot: {
    width:       '8px',
    height:      '8px',
    borderRadius:'50%',
    background:  'rgba(168,148,255,0.6)',
    animation:   'pulse 1.2s ease-in-out infinite',
  },
}
