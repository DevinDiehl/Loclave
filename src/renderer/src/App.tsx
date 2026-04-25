import { useState, useEffect, useCallback } from 'react'
import UnlockScreen from './components/UnlockScreen'

export default function App() {
  const [checking,      setChecking]      = useState(true)   // initial load
  const [locked,        setLocked]        = useState(true)
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)

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
      <UnlockScreen
        isFirstLaunch={isFirstLaunch}
        onUnlocked={() => {
          setLocked(false)
          setIsFirstLaunch(false)
        }}
      />
    )
  }

  // ── Main vault UI (placeholder until Sidebar + EntryList are built) ────────
  return (
    <div style={mainStyles.root}>
      <p style={mainStyles.placeholder}>
        🔓 Vault unlocked — Sidebar &amp; EntryList coming next.
      </p>
      <button
        style={mainStyles.lockBtn}
        onClick={async () => {
          await window.api.lock()
          setLocked(true)
        }}
      >
        Lock Vault
      </button>
    </div>
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

const mainStyles: Record<string, React.CSSProperties> = {
  root: {
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100vh',
    background:     '#0d0d12',
    gap:            '20px',
  },
  placeholder: {
    color:       'rgba(255,255,255,0.5)',
    fontFamily:  'monospace',
    fontSize:    '14px',
  },
  lockBtn: {
    padding:      '10px 24px',
    background:   'rgba(168,148,255,0.15)',
    border:       '1px solid rgba(168,148,255,0.3)',
    borderRadius: '8px',
    color:        'rgba(168,148,255,0.9)',
    fontFamily:   'monospace',
    fontSize:     '13px',
    cursor:       'pointer',
  },
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