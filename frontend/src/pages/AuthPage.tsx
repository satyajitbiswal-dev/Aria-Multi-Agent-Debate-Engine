import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { authApi } from '@/lib/api'

type Tab = 'login' | 'register'

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl
        border border-slate-600/60 bg-slate-800/60 hover:bg-slate-700/60 hover:border-slate-500/60
        text-sm text-gray-200 transition-all font-medium disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </button>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-4 min-w-0">
      <div className="flex-1 h-px bg-slate-700/60" />
      <span className="text-xs text-slate-500 shrink-0">or</span>
      <div className="flex-1 h-px bg-slate-700/60" />
    </div>
  )
}

const inputClass = `w-full min-w-0 bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5
  text-sm text-gray-100 placeholder-slate-500 focus:outline-none focus:border-slate-400/60 transition-colors`

export function AuthPage() {
  const [tab,       setTab]       = useState<Tab>('login')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [password2, setPassword2] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [googleOk,  setGoogleOk]  = useState(true)

  const { login, register } = useAuth()

  useEffect(() => {
    authApi.googleStatus()
      .then(d => setGoogleOk(d.configured))
      .catch(() => setGoogleOk(false))
  }, [])
  const navigate = useNavigate()

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(email, password)
      } else {
        await register(email, password, password2, firstName, lastName)
      }
      navigate('/')
    } catch (e: any) {
      const data = e?.response?.data
      if (data) {
        const msg = typeof data === 'string'
          ? data
          : Object.values(data).flat().join(' ')
        setError(msg)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="app-shell min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      <div className="mb-6 sm:mb-8 text-center w-full max-w-sm">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-mono"
        >
          ⚡ Aria
        </button>
        <p className="text-slate-400 text-sm mt-1">Multi-Agent Debate Engine</p>
      </div>

      <div className="w-full max-w-sm min-w-0">
        <div className="auth-card">
          <div className="flex rounded-xl bg-slate-800/50 p-1 mb-6 gap-1">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError('') }}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg text-sm font-medium transition-all min-w-0',
                  tab === t ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-slate-200',
                )}
              >
                {t === 'login' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          {googleOk ? (
            <GoogleButton onClick={authApi.googleLogin} disabled={loading} />
          ) : (
            <p className="text-xs text-amber-400/90 bg-amber-950/30 border border-amber-800/40 rounded-xl px-3 py-2.5 text-center">
              Google sign-in is not configured. Add <code className="font-mono">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="font-mono">GOOGLE_CLIENT_SECRET</code> to <code className="font-mono">backend/.env</code>, then restart the backend.
            </p>
          )}
          <Divider />

          <div className="space-y-3">
            {tab === 'register' && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={clsx(inputClass, 'sm:flex-1')}
                />
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={clsx(inputClass, 'sm:flex-1')}
                />
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Email address"
              autoComplete="email"
              autoFocus
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className={inputClass}
            />
            {tab === 'register' && (
              <input
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Confirm password"
                autoComplete="new-password"
                className={inputClass}
              />
            )}
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 break-words">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 w-full bg-white text-slate-900 rounded-xl py-2.5 text-sm font-semibold
              hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin" />
                  {tab === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              : tab === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4 px-2">
          Your debate history is saved to your account.
          {tab === 'login'
            ? <> Don&apos;t have one? <button type="button" onClick={() => setTab('register')} className="text-slate-400 hover:text-white underline">Sign up</button></>
            : <> Already have one? <button type="button" onClick={() => setTab('login')} className="text-slate-400 hover:text-white underline">Sign in</button></>
          }
        </p>
      </div>
    </div>
  )
}
