import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { Debate } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-gray-700 text-gray-300',
  running:   'bg-blue-500/20 text-blue-300',
  judging:   'bg-purple-500/20 text-purple-300',
  completed: 'bg-green-500/20 text-green-300',
  failed:    'bg-red-500/20 text-red-300',
}

const ROUND_COLORS: Record<number, string> = {
  1: 'text-emerald-500', 2: 'text-blue-500', 3: 'text-purple-500', 4: 'text-orange-500',
}

export function HistoryPage() {
  const [debates, setDebates] = useState<Debate[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    debatesApi.list()
      .then(setDebates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authLoading])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-white font-semibold">Debate History</h1>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {/* Not logged in */}
        {!authLoading && !user && (
          <div className="text-center py-20 space-y-4">
            <p className="text-4xl">🔒</p>
            <p className="text-gray-400">Sign in to see your debate history.</p>
            <button
              onClick={() => navigate('/auth')}
              className="bg-white text-gray-900 text-sm font-medium px-5 py-2 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Sign in
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && user && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && user && debates.length === 0 && (
          <div className="text-center py-20 text-gray-500 space-y-3">
            <p className="text-4xl">💬</p>
            <p>No debates yet.</p>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              Start your first debate
            </button>
          </div>
        )}

        {/* List */}
        {!loading && user && debates.length > 0 && (
          <div className="space-y-3">
            {debates.map(d => (
              <button
                key={d.id}
                onClick={() => navigate(`/debate/${d.id}`)}
                className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-600
                  rounded-xl px-5 py-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-gray-200 text-sm font-medium group-hover:text-white
                    transition-colors line-clamp-2">
                    {d.topic}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={clsx('text-[10px] font-medium', ROUND_COLORS[d.num_rounds] ?? 'text-gray-500')}>
                      {d.num_rounds}R
                    </span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full', STATUS_STYLES[d.status] ?? STATUS_STYLES.pending)}>
                      {d.status}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 text-xs mt-2">{new Date(d.created_at).toLocaleString()}</p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
