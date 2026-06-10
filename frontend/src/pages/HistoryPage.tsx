import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { debatesApi } from '@/lib/api'
import type { Debate } from '@/types'
import { clsx } from 'clsx'

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-gray-700 text-gray-300',
  running:   'bg-blue-500/20 text-blue-300',
  rebuttal:  'bg-yellow-500/20 text-yellow-300',
  judging:   'bg-purple-500/20 text-purple-300',
  completed: 'bg-green-500/20 text-green-300',
  failed:    'bg-red-500/20 text-red-300',
}

export function HistoryPage() {
  const [debates, setDebates] = useState<Debate[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    debatesApi.list()
      .then(setDebates)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Back
        </button>
        <h1 className="text-white font-semibold">Debate History</h1>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-900 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && debates.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-4">💬</p>
            <p>No debates yet. Start one from the home page.</p>
          </div>
        )}

        {!loading && debates.length > 0 && (
          <div className="space-y-3">
            {debates.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/debate/${d.id}`)}
                className="w-full text-left bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl px-5 py-4 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-gray-200 text-sm font-medium group-hover:text-white transition-colors line-clamp-2">
                    {d.topic}
                  </p>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full shrink-0', STATUS_STYLES[d.status] || STATUS_STYLES.pending)}>
                    {d.status}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  {new Date(d.created_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
