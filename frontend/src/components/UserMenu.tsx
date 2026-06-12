import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '@/context/AuthContext'

export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => navigate('/auth')}
        className="text-xs text-gray-400 hover:text-white border border-gray-700
          hover:border-gray-500 px-3 py-1.5 rounded-lg transition-all"
      >
        Sign in
      </button>
    )
  }

  const initials = [user.first_name, user.last_name]
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase() || user.email[0].toUpperCase()

  return (
    <div ref={ref} className="relative z-[100]">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 group"
      >
        {user.avatar ? (
          <img
            src={user.avatar}
            alt={initials}
            className="w-7 h-7 rounded-full border border-gray-700 group-hover:border-gray-500 transition-all"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40
            flex items-center justify-center text-xs font-bold text-blue-300
            group-hover:border-blue-400 transition-all">
            {initials}
          </div>
        )}
        <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors hidden sm:block">
          {user.first_name || user.email.split('@')[0]}
        </span>
        <span className={clsx('text-gray-600 text-[10px] transition-transform', open && 'rotate-180')}>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-52 bg-slate-900 border border-slate-700
          rounded-xl shadow-2xl shadow-black/60 py-1 z-[200]">
          <div className="px-3 py-2 border-b border-slate-700">
            <p className="text-xs text-white font-medium truncate">
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.email}
            </p>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); navigate('/history') }}
            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white
              hover:bg-slate-800 transition-colors"
          >
            📋 Debate History
          </button>
          <button
            type="button"
            onClick={async () => { setOpen(false); await logout(); navigate('/') }}
            className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:text-red-400
              hover:bg-slate-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
