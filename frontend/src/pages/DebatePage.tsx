import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopicInput } from '@/components/TopicInput'
import { DebateStatusBanner } from '@/components/DebateStatusBanner'
import { ExportButton } from '@/components/ExportButton'
import { DebateThread, VoiceSelector } from '@/components/DebateThread'
import { useDebateSocket } from '@/hooks/useDebateSocket'
import { debatesApi } from '@/lib/api'
import type { DebateStatus } from '@/types'

export function DebatePage() {
  const navigate = useNavigate()
  const [debateId,      setDebateId]      = useState<string | null>(null)
  const [currentTopic,  setCurrentTopic]  = useState('')
  const [numRounds,     setNumRounds]     = useState(2)
  const [isLoading,     setIsLoading]     = useState(false)
  const [error,         setError]         = useState('')
  const [debateStatus,  setDebateStatus]  = useState<DebateStatus>('pending')
  const [voice,         setVoice]         = useState<'male' | 'female'>('female')

  // Track which round is currently live (for the banner)
  const [currentRound, setCurrentRound] = useState(1)

  const { judge, scores, thread } = useDebateSocket(debateId)

  // Update currentRound from the thread (highest round that has an active entry)
  useEffect(() => {
    const active = thread.filter(e => e.isActive || e.isDone)
    if (active.length > 0) {
      setCurrentRound(Math.max(...active.map(e => e.roundNumber)))
    }
  }, [thread])

  // Poll debate status
  useEffect(() => {
    if (!debateId) return
    const interval = setInterval(async () => {
      try {
        const d = await debatesApi.get(debateId)
        setDebateStatus(d.status)
        if (d.status === 'completed' || d.status === 'failed') clearInterval(interval)
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [debateId])

  const handleStart = async (topic: string, rounds: number) => {
    setIsLoading(true)
    setError('')
    setDebateStatus('pending')
    setCurrentRound(1)
    try {
      const debate = await debatesApi.create(topic, rounds)
      setCurrentTopic(topic)
      setNumRounds(rounds)
      setDebateId(debate.id)
      setDebateStatus('running')
    } catch (e: any) {
      setError(e?.response?.data?.topic?.[0] || 'Failed to start debate. Is the backend running?')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setDebateId(null); setCurrentTopic(''); setError('')
    setDebateStatus('pending'); setCurrentRound(1)
  }

  const isTerminal = debateStatus === 'completed' || debateStatus === 'failed'

  const ROUND_COLORS: Record<number, string> = {
    1: 'text-emerald-400', 2: 'text-blue-400', 3: 'text-purple-400', 4: 'text-orange-400',
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white tracking-tight">⚡ Aria</span>
          <span className="text-xs text-gray-600 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800">
            Multi-Agent Debate
          </span>
        </div>
        <div className="flex items-center gap-3">
          {debateId && <VoiceSelector value={voice} onChange={setVoice} />}
          <button onClick={() => navigate('/history')} className="text-xs text-gray-500 hover:text-white transition-colors">
            History
          </button>
          {debateId && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-white bg-gray-900 hover:bg-gray-800 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              ← New Debate
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {/* Landing */}
        {!debateId && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 p-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-3">Drop a topic. Watch AI argue.</h1>
              <p className="text-gray-500 text-base max-w-lg">
                Pick how many rounds you want. Advocate and Critic trade arguments, then a Judge delivers the verdict.
              </p>
            </div>
            <TopicInput onStart={handleStart} isLoading={isLoading} />
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Active debate */}
        {debateId && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Sticky header */}
            <div className="shrink-0 border-b border-gray-800/60 bg-gray-950/95 backdrop-blur px-6 py-3 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">Debating</p>
                    <span className={clsx('text-[10px] font-semibold', ROUND_COLORS[numRounds] ?? 'text-gray-400')}>
                      · {numRounds} round{numRounds !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <h2 className="text-sm font-semibold text-white truncate">"{currentTopic}"</h2>
                </div>
                {isTerminal && debateId && (
                  <ExportButton debateId={debateId} topic={currentTopic} />
                )}
              </div>
              <DebateStatusBanner
                status={debateStatus}
                numRounds={numRounds}
                currentRound={currentRound}
              />
            </div>

            {/* Scrollable thread */}
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 max-w-4xl mx-auto w-full">
              {thread.length === 0 && (
                <div className="flex items-center justify-center h-32 gap-3 text-gray-600 text-sm">
                  <span className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
                  Connecting agents…
                </div>
              )}
              <DebateThread
                thread={thread}
                judgeState={judge}
                scores={scores}
                voiceChoice={voice}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function clsx(...args: (string | boolean | undefined | null)[]) {
  return args.filter(Boolean).join(' ')
}
