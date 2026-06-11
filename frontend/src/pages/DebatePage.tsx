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
  const [debateId,     setDebateId]     = useState<string | null>(null)
  const [currentTopic, setCurrentTopic] = useState('')
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState('')
  const [debateStatus, setDebateStatus] = useState<DebateStatus>('pending')
  const [voice,        setVoice]        = useState<'male' | 'female'>('female')

  const { judge, scores, thread } = useDebateSocket(debateId)

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

  const isTerminal = debateStatus === 'completed' || debateStatus === 'failed'

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-white tracking-tight">⚡ Aria</span>
          <span className="text-xs text-gray-600 bg-gray-900 px-2 py-0.5 rounded-full border border-gray-800">
            Multi-Agent Debate
          </span>
        </div>
        <div className="flex items-center gap-3">
          {debateId && <VoiceSelector value={voice} onChange={setVoice} />}
          <button
            onClick={() => navigate('/history')}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            History
          </button>
          {debateId && (
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-white transition-colors bg-gray-900 hover:bg-gray-800 border border-gray-800 px-3 py-1.5 rounded-lg"
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
              <p className="text-gray-400 text-lg max-w-xl">
                Advocate and Critic battle across 4 rounds. A Judge delivers the final verdict.
              </p>
              {/* How it works */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-600">
                {[
                  { icon: '🔴', label: 'Round 1', desc: 'Advocate opens' },
                  { icon: '🔵', label: 'Round 2', desc: 'Critic responds' },
                  { icon: '🔴', label: 'Round 3', desc: 'Advocate rebuts' },
                  { icon: '🔵', label: 'Round 4', desc: 'Critic closes' },
                  { icon: '⚖️',  label: 'Verdict', desc: 'Judge scores' },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{step.icon}</span>
                      <span className="text-gray-500 font-medium">{step.label}</span>
                      <span className="text-gray-700">{step.desc}</span>
                    </div>
                    {i < 4 && <span className="text-gray-800 mb-4">→</span>}
                  </div>
                ))}
              </div>
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
            {/* Sticky topic + status bar */}
            <div className="shrink-0 border-b border-gray-800/60 bg-gray-950/95 backdrop-blur px-6 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest">Debating</p>
                  <h2 className="text-sm font-semibold text-white truncate">"{currentTopic}"</h2>
                </div>
                {isTerminal && debateId && (
                  <ExportButton debateId={debateId} topic={currentTopic} />
                )}
              </div>
              <DebateStatusBanner status={debateStatus} />
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
