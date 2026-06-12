import axios from 'axios'
import type { Debate } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

export const debatesApi = {
  create: (topic: string, num_rounds: number = 2) =>
    api.post<Debate>('/api/debates/', { topic, num_rounds }).then(r => r.data),

  get: (id: string) =>
    api.get<Debate>(`/api/debates/${id}/`).then(r => r.data),

  list: () =>
    api.get<Debate[]>('/api/debates/').then(r => r.data),

  suggestions: () =>
    api.get<{ suggestions: string[] }>('/api/debates/suggestions/').then(r => r.data),
}

export default api
