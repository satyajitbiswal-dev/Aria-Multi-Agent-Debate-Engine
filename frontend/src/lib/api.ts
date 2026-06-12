import axios from 'axios'
import type { Debate, User } from '@/types'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,   // needed for Google OAuth session cookie exchange
})

// Attach Bearer token when available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('aria_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('aria_refresh')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE}/api/accounts/token/refresh/`, { refresh })
          localStorage.setItem('aria_access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('aria_access')
          localStorage.removeItem('aria_refresh')
          window.location.href = '/auth'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ── Debates ───────────────────────────────────────────────────────────────────
export const debatesApi = {
  create: (topic: string, num_rounds = 2, interactive_mode = false) =>
    api.post<Debate>('/api/debates/', { topic, num_rounds, interactive_mode }).then(r => r.data),

  submitStance: (id: string, stance: 'advocate' | 'critic', thought = '') =>
    api.post<Debate>(`/api/debates/${id}/stance/`, { stance, thought }).then(r => r.data),

  get: (id: string) =>
    api.get<Debate>(`/api/debates/${id}/`).then(r => r.data),

  list: () =>
    api.get<Debate[]>('/api/debates/').then(r => r.data),

  suggestions: () =>
    api.get<{ suggestions: string[] }>('/api/debates/suggestions/').then(r => r.data),

  improveTopic: (topic: string) =>
    api.post<{ original: string; improved: string; explanation: string }>(
      '/api/debates/improve-topic/', { topic }
    ).then(r => r.data),
}

// ── Auth ──────────────────────────────────────────────────────────────────────
interface TokenResponse { access: string; refresh: string; user: User }

export const authApi = {
  register: (data: {
    email: string; password: string; password2: string;
    first_name?: string; last_name?: string
  }) => api.post<TokenResponse>('/api/accounts/register/', data).then(r => r.data),

  login: (email: string, password: string) =>
    api.post<TokenResponse>('/api/accounts/login/', { email, password }).then(r => r.data),

  logout: (refresh: string, access: string) =>
    api.post('/api/accounts/logout/', { refresh }, {
      headers: { Authorization: `Bearer ${access}` }
    }),

  me: (token: string) =>
    api.get<User>('/api/accounts/me/', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.data),

  googleStatus: () =>
    api.get<{ configured: boolean }>('/api/accounts/google/status/').then(r => r.data),

  googleLogin: () => {
    window.location.href = `${BASE}/accounts/google/login/`
  },

  googleToken: (oauthToken?: string) =>
    api.post<TokenResponse>(
      '/api/accounts/google/token/',
      oauthToken ? { oauth_token: oauthToken } : {},
    ).then(r => r.data),
}

export default api
