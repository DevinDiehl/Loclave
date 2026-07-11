import { useState, useEffect, useRef } from 'react'
import { UnlockScreenProps } from '../../../types/types'
import appIcon from '../../../../resources/icon.png'

export default function UnlockScreen({ isFirstLaunch, onUnlocked, theme = 'dark' }: UnlockScreenProps) {
  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')
  const [error, setError]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const [mounted, setMounted]             = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const inputRef                          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (mounted) inputRef.current?.focus()
  }, [mounted])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Enter your master password.')
      return
    }

    if (isFirstLaunch) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setError('Passwords do not match.')
        return
      }
    }

    setLoading(true)

    try {
      if (isFirstLaunch) {
        await window.api.setupMasterPassword(password)
      } else {
        const success = await window.api.unlock(password)
        if (!success) {
          setError('Incorrect password. Try again.')
          setLoading(false)
          setPassword('')
          inputRef.current?.focus()
          return
        }
      }
      onUnlocked()
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }



  }
  

  return (
    <div style={{ ...styles.root, background: theme === 'light' ? '#f5f6fb' : '#0d0d12' }}>
      
      {/* Ambient background blobs */}
      <div style={styles.blobTopLeft} />
      <div style={styles.blobBottomRight} />

      {/* Noise texture overlay */}
      <div style={styles.noise} />
      {/* Card */}
      <div style={{
        ...styles.card,
        background: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.03)',
        border: theme === 'light' ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.07)',
        boxShadow: theme === 'light' ? '0 24px 70px rgba(15,23,42,0.08)' : '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        opacity:    mounted ? 1 : 0,
        transform:  mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.98)',
        transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>

        {/* App brand */}
        <div style={{
          ...styles.brandRow,
          opacity:    mounted ? 1 : 0,
          transform:  mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
        }}>
          <img src={appIcon} alt="Lockstep" style={styles.appIcon} />
          <span style={{ ...styles.brandText, color: theme === 'light' ? '#18202c' : '#f0eeff' }}>Lockstep</span>
        </div>

        {/* Title */}
        <div style={{
          ...styles.titleBlock,
          opacity:    mounted ? 1 : 0,
          transform:  mounted ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.5s ease 0.18s, transform 0.5s ease 0.18s',
        }}>
          <h1 style={{ ...styles.title, color: theme === 'light' ? '#18202c' : '#f0eeff' }}>
            {isFirstLaunch ? 'Create Vault' : 'Unlock Vault'}
          </h1>
          <p style={{ ...styles.subtitle, color: theme === 'light' ? 'rgba(24,32,44,0.62)' : 'rgba(255,255,255,0.38)' }}>
            {isFirstLaunch
              ? 'Set a master password to protect your vault.'
              : 'Enter your master password to continue.'}
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            ...styles.form,
            opacity:    mounted ? 1 : 0,
            transform:  mounted ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.5s ease 0.26s, transform 0.5s ease 0.26s',
          }}
        >
          {/* Password field */}
          <div style={styles.fieldWrap}>
            <label style={{ ...styles.label, color: theme === 'light' ? 'rgba(24,32,44,0.6)' : 'rgba(255,255,255,0.4)' }}>
              {isFirstLaunch ? 'Master Password' : 'Password'}
            </label>
            <div style={styles.inputRow}>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••••••"
                style={{
                  ...styles.input,
                  background: theme === 'light' ? 'rgba(248,250,252,0.95)' : 'rgba(255,255,255,0.05)',
                  borderColor: error ? '#f87171' : (theme === 'light' ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)'),
                  color: theme === 'light' ? '#0f172a' : '#f0eeff',
                }}
                disabled={loading}
                autoComplete={isFirstLaunch ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ ...styles.eyeBtn, color: theme === 'light' ? 'rgba(24,32,44,0.36)' : 'rgba(255,255,255,0.3)' }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Confirm field — first launch only */}
          {isFirstLaunch && (
            <div style={styles.fieldWrap}>
              <label style={{ ...styles.label, color: theme === 'light' ? 'rgba(24,32,44,0.6)' : 'rgba(255,255,255,0.4)' }}>Confirm Password</label>
              <div style={styles.inputRow}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  placeholder="••••••••••••"
                  style={{
                    ...styles.input,
                    borderColor: error ? '#f87171' : 'rgba(255,255,255,0.1)',
                  }}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p style={styles.error}>
              <span style={styles.errorDot} />
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor:  loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? <span style={styles.spinner} />
              : isFirstLaunch ? 'Create Vault' : 'Unlock'}
          </button>
        </form>

        {/* Idle lock note */}
        {!isFirstLaunch && (
          <p style={{
            ...styles.note,
            opacity:    mounted ? 1 : 0,
            transition: 'opacity 0.5s ease 0.4s',
          }}>
            Welcome to Lockstep — your vault is ready when you are.
          </p>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { outline: none; border-color: rgba(168,148,255,0.6) !important; box-shadow: 0 0 0 3px rgba(168,148,255,0.12); }
        button:focus-visible { outline: 2px solid rgba(168,148,255,0.6); outline-offset: 2px; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-blob {
          0%, 100% { transform: scale(1) translate(0, 0); }
          50%       { transform: scale(1.08) translate(10px, -10px); }
        }
      `}</style>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    position:        'fixed',
    inset:           0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      '#0d0d12',
    fontFamily:      "'DM Mono', monospace",
    overflow:        'hidden',
  },
  blobTopLeft: {
    position:        'absolute',
    top:             '-160px',
    left:            '-120px',
    width:           '480px',
    height:          '480px',
    borderRadius:    '50%',
    background:      'radial-gradient(circle, rgba(108,80,180,0.35) 0%, transparent 70%)',
    filter:          'blur(40px)',
    animation:       'pulse-blob 8s ease-in-out infinite',
    pointerEvents:   'none',
  },
  blobBottomRight: {
    position:        'absolute',
    bottom:          '-140px',
    right:           '-100px',
    width:           '420px',
    height:          '420px',
    borderRadius:    '50%',
    background:      'radial-gradient(circle, rgba(60,120,220,0.25) 0%, transparent 70%)',
    filter:          'blur(40px)',
    animation:       'pulse-blob 10s ease-in-out infinite reverse',
    pointerEvents:   'none',
  },
  noise: {
    position:        'absolute',
    inset:           0,
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
    backgroundRepeat:'repeat',
    backgroundSize:  '128px',
    pointerEvents:   'none',
    opacity:         0.6,
  },
  card: {
    position:        'relative',
    zIndex:          10,
    width:           '100%',
    maxWidth:        '400px',
    padding:         '48px 40px 40px',
    background:      'rgba(255,255,255,0.03)',
    border:          '1px solid rgba(255,255,255,0.07)',
    borderRadius:    '20px',
    backdropFilter:  'blur(24px)',
    boxShadow:       '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  brandRow: {
    display:         'flex',
    alignItems:      'center',
    gap:             '12px',
    marginBottom:    '28px',
  },
  appIcon: {
    width:           '44px',
    height:          '44px',
    borderRadius:    '12px',
    objectFit:       'cover',
    boxShadow:       '0 8px 24px rgba(0, 0, 0, 0.2)',
  },
  brandText: {
    fontFamily:      "'DM Serif Display', serif",
    fontSize:        '24px',
    fontWeight:      400,
    letterSpacing:   '-0.02em',
  },
  titleBlock: {
    marginBottom:    '32px',
  },
  title: {
    fontFamily:      "'DM Serif Display', serif",
    fontSize:        '26px',
    fontWeight:      400,
    color:           '#f0eeff',
    letterSpacing:   '-0.02em',
    marginBottom:    '8px',
  },
  subtitle: {
    fontSize:        '13px',
    color:           'rgba(255,255,255,0.38)',
    lineHeight:      1.6,
    letterSpacing:   '0.01em',
  },
  form: {
    display:         'flex',
    flexDirection:   'column',
    gap:             '16px',
  },
  fieldWrap: {
    display:         'flex',
    flexDirection:   'column',
    gap:             '8px',
  },
  label: {
    fontSize:        '11px',
    fontWeight:      500,
    color:           'rgba(255,255,255,0.4)',
    letterSpacing:   '0.08em',
    textTransform:   'uppercase',
  },
  inputRow: {
    position:        'relative',
    display:         'flex',
    alignItems:      'center',
  },
  input: {
    width:           '100%',
    padding:         '12px 44px 12px 14px',
    background:      'rgba(255,255,255,0.05)',
    border:          '1px solid rgba(255,255,255,0.1)',
    borderRadius:    '10px',
    color:           '#f0eeff',
    fontSize:        '14px',
    fontFamily:      "'DM Mono', monospace",
    letterSpacing:   '0.04em',
    transition:      'border-color 0.2s, box-shadow 0.2s',
  },
  eyeBtn: {
    position:        'absolute',
    right:           '12px',
    background:      'none',
    border:          'none',
    color:           'rgba(255,255,255,0.3)',
    cursor:          'pointer',
    padding:         '4px',
    display:         'flex',
    alignItems:      'center',
    transition:      'color 0.2s',
  },
  error: {
    display:         'flex',
    alignItems:      'center',
    gap:             '8px',
    fontSize:        '12px',
    color:           '#f87171',
    letterSpacing:   '0.01em',
  },
  errorDot: {
    display:         'inline-block',
    width:           '5px',
    height:          '5px',
    borderRadius:    '50%',
    background:      '#f87171',
    flexShrink:      0,
  },
  submitBtn: {
    marginTop:       '8px',
    padding:         '13px',
    background:      'linear-gradient(135deg, rgba(168,148,255,0.9) 0%, rgba(108,80,220,0.9) 100%)',
    border:          'none',
    borderRadius:    '10px',
    color:           '#fff',
    fontSize:        '13px',
    fontFamily:      "'DM Mono', monospace",
    fontWeight:      500,
    letterSpacing:   '0.06em',
    textTransform:   'uppercase',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    height:          '46px',
    transition:      'opacity 0.2s, transform 0.15s',
    boxShadow:       '0 4px 20px rgba(108,80,220,0.35)',
  },
  spinner: {
    display:         'inline-block',
    width:           '16px',
    height:          '16px',
    border:          '2px solid rgba(255,255,255,0.3)',
    borderTopColor:  '#fff',
    borderRadius:    '50%',
    animation:       'spin 0.7s linear infinite',
  },
  note: {
    marginTop:       '24px',
    fontSize:        '11px',
    color:           'rgba(255,255,255,0.2)',
    textAlign:       'center',
    letterSpacing:   '0.02em',
    lineHeight:      1.6,
  },
}