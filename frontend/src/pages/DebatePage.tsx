import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AgentPanel } from '@/components/AgentPanel'
import { ScoreBoard } from '@/components/ScoreBoard'
import { TopicInput } from '@/components/TopicInput'
import { DebateStatusBanner } from '@/components/DebateStatusBanner'
import { ExportButton } from '@/components/ExportButton'
import { useDebateSocket } from '@/hooks/useDebateSocket'
import { debatesApi } from '@/lib/api'
import type { DebateStatus } from '@/types'

export function DebatePage() {
  const navigate = useNavigate()
  const [debateId, setDebateId] = useState<string | null>(null)
  const [currentTopic, setCurrentTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [debateStatus, setDebateStatus] = useState<DebateStatus>('pending')

  const { advocate, critic, judge, scores } = useDebateSocket(debateId)

  // Poll debate status from DB every 3s until terminal state
  useEffect(() => {
    if (!debateId) return
    const interval = setInterval(async () => {
      try {
        const d = await debatesApi.get(debateId)
        setDebateStatus(d.status)
        if (d.status === 'completed' || d.status === 'failed') {
          clearInterval(interval)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [debateId])

  const handleStart = async (topic: string) => {
    setIsLoading(true)
    setError('')
    setDebateStatus('pending')
    try {
      const debate = await debatesApi.create(topic)
      setCurrentTopic(topic)
      setDebateId(debate.id)
      setDebateStatus('running')
    } catch (e: any) {
      setError(e?.response?.data?.topic?.[0] || 'Failed to start debate. Is the backend running?')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setDebateId(null)
    setCurrentTopic('')
    setError('')
    setDebateStatus('pending')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white tracking-tight">⚡ Aria</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded-full">
            Multi-Agent Debate Engine
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/history')}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            History
          </button>
          {debateId && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"
            >
              ← New Debate
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col p-6 gap-5 min-h-0">
        {/* Landing */}
        {!debateId && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-3">
                Drop a topic. Watch AI argue.
              </h1>
              <p className="text-gray-400 text-lg max-w-xl">
                Three agents spin up in real time — one argues for, one against,
                a judge scores and delivers a verdict.
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
          <>
            {/* Topic + status row */}
            <div className="shrink-0 flex flex-col items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Debating</p>
                <h2 className="text-xl font-semibold text-white">"{currentTopic}"</h2>
              </div>
              <DebateStatusBanner status={debateStatus} />
            </div>

            {/* 3-panel grid */}
            <div className="flex-1 grid grid-cols-3 gap-4 min-h-0" style={{ minHeight: '500px' }}>
              <AgentPanel role="advocate" state={advocate} />
              <AgentPanel role="critic"   state={critic}   />
              <AgentPanel role="judge"    state={judge}    />
            </div>

            {/* Scores */}
            {scores && <ScoreBoard scores={scores} />}

            {/* Export row — shown once completed */}
            {debateStatus === 'completed' && (
              <div className="flex justify-end shrink-0">
                <ExportButton debateId={debateId} topic={currentTopic} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
