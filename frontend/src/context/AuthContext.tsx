import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type { User, AuthState } from '@/types'
import { authApi } from '@/lib/api'

interface AuthContextValue extends AuthState {
  login:    (email: string, password: string) => Promise<void>
  register: (email: string, password: string, password2: string, firstName?: string, lastName?: string) => Promise<void>
  logout:   () => Promise<void>
  /** Called after Google OAuth redirect — exchanges token for JWT */
  handleGoogleCallback: (oauthToken?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY_ACCESS  = 'aria_access'
const STORAGE_KEY_REFRESH = 'aria_refresh'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,         setUser]         = useState<User | null>(null)
  const [accessToken,  setAccessToken]  = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_ACCESS))
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_REFRESH))
  const [isLoading,    setIsLoading]    = useState(true)

  const _persist = (access: string, refresh: string, u: User) => {
    localStorage.setItem(STORAGE_KEY_ACCESS,  access)
    localStorage.setItem(STORAGE_KEY_REFRESH, refresh)
    setAccessToken(access)
    setRefreshToken(refresh)
    setUser(u)
  }

  const _clear = () => {
    localStorage.removeItem(STORAGE_KEY_ACCESS)
    localStorage.removeItem(STORAGE_KEY_REFRESH)
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
  }

  // On mount — if we have a stored token, fetch /me to verify it's still valid
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY_ACCESS)
    if (!token) { setIsLoading(false); return }
    authApi.me(token)
      .then(u => setUser(u))
      .catch(() => _clear())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password)
    _persist(data.access, data.refresh, data.user)
  }, [])

  const register = useCallback(async (
    email: string, password: string, password2: string,
    firstName = '', lastName = '',
  ) => {
    const data = await authApi.register({ email, password, password2, first_name: firstName, last_name: lastName })
    _persist(data.access, data.refresh, data.user)
  }, [])

  const logout = useCallback(async () => {
    if (refreshToken) {
      try { await authApi.logout(refreshToken, accessToken!) } catch { /* ignore */ }
    }
    _clear()
  }, [refreshToken, accessToken])

  const handleGoogleCallback = useCallback(async (oauthToken?: string) => {
    const data = await authApi.googleToken(oauthToken)
    _persist(data.access, data.refresh, data.user)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, accessToken, refreshToken, isLoading,
      login, register, logout, handleGoogleCallback,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
