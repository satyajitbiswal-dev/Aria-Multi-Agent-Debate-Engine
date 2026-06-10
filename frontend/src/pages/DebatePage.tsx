import { useState } from 'react'
import { AgentPanel } from '@/components/AgentPanel'
import { ScoreBoard } from '@/components/ScoreBoard'
import { TopicInput } from '@/components/TopicInput'
import { useDebateSocket } from '@/hooks/useDebateSocket'
import { debatesApi } from '@/lib/api'

export function DebatePage() {
  const [debateId, setDebateId] = useState<string | null>(null)
  const [currentTopic, setCurrentTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const { advocate, critic, judge, scores } = useDebateSocket(debateId)

  const handleStart = async (topic: string) => {
    setIsLoading(true)
    setError('')
    try {
      const debate = await debatesApi.create(topic)
      setCurrentTopic(topic)
      setDebateId(debate.id)
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
        {debateId && (
          <button
            onClick={handleReset}
            className="text-xs text-gray-400 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg"
          >
            ← New Debate
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col p-6 gap-6 min-h-0">
        {/* Topic input (shown when no active debate) */}
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
            {/* Topic banner */}
            <div className="shrink-0 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Debating</p>
              <h2 className="text-xl font-semibold text-white">"{currentTopic}"</h2>
            </div>

            {/* 3-panel grid */}
            <div className="flex-1 grid grid-cols-3 gap-4 min-h-0" style={{ minHeight: '500px' }}>
              <AgentPanel role="advocate" state={advocate} />
              <AgentPanel role="critic" state={critic} />
              <AgentPanel role="judge" state={judge} />
            </div>

            {/* Scores — shown when judge is done */}
            {scores && <ScoreBoard scores={scores} />}
          </>
        )}
      </main>
    </div>
  )
}
