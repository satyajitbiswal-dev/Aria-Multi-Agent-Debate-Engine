import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopicInput } from '@/components/TopicInput'
import { DebateStatusBanner } from '@/components/DebateStatusBanner'
import { DebateThread, VoiceSelector } from '@/components/DebateThread'
import { UserMenu } from '@/components/UserMenu'
import { InteractiveModeToggle } from '@/components/InteractiveModeToggle'
import { StancePanel } from '@/components/StancePanel'
import { useDebateSocket } from '@/hooks/useDebateSocket'
import { useAuth } from '@/context/AuthContext'
import { debatesApi } from '@/lib/api'
import type { DebateStatus, UserStance } from '@/types'

const clsx = (...args: (string | boolean | undefined | null)[]) => args.filter(Boolean).join(' ')

const ROUND_COLORS: Record<number, string> = {
  1: 'text-emerald-400', 2: 'text-blue-400', 3: 'text-purple-400', 4: 'text-orange-400',
}

export function DebatePage() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [debateId,         setDebateId]         = useState<string | null>(null)
  const [currentTopic,     setCurrentTopic]     = useState('')
  const [numRounds,        setNumRounds]        = useState(2)
  const [isLoading,        setIsLoading]        = useState(false)
  const [error,            setError]            = useState('')
  const [debateStatus,     setDebateStatus]     = useState<DebateStatus>('pending')
  const [currentRound,     setCurrentRound]     = useState(1)
  const [voice,            setVoice]            = useState<'male' | 'female'>('female')
  const [interactiveMode,  setInteractiveMode]  = useState(false)
  const [awaitingStance,   setAwaitingStance]   = useState(false)
  const [stanceSubmitting, setStanceSubmitting]  = useState(false)

  const { judge, scores, thread } = useDebateSocket(debateId)

  useEffect(() => {
    const active = thread.filter(e => e.isActive || e.isDone)
    if (active.length > 0) setCurrentRound(Math.max(...active.map(e => e.roundNumber)))
  }, [thread])

  useEffect(() => {
    if (!debateId) return
    const poll = async () => {
      try {
        const d = await debatesApi.get(debateId)
        setDebateStatus(d.status)
        setAwaitingStance(!!d.awaiting_stance)
        if (d.status === 'completed' || d.status === 'failed') return false
      } catch { /* ignore */ }
      return true
    }
    poll()
    const iv = setInterval(async () => {
      const cont = await poll()
      if (!cont) clearInterval(iv)
    }, 2000)
    return () => clearInterval(iv)
  }, [debateId])

  const round1Complete = thread.some(e => e.role === 'advocate' && e.roundNumber === 1 && e.isDone)
    && thread.some(e => e.role === 'critic' && e.roundNumber === 1 && e.isDone)

  const showStancePanel = !!user && interactiveMode && awaitingStance && round1Complete

  const handleStart = async (topic: string, rounds: number) => {
    setIsLoading(true); setError(''); setDebateStatus('pending'); setCurrentRound(1)
    setAwaitingStance(false)
    try {
      const useInteractive = !!user && interactiveMode
      const debate = await debatesApi.create(topic, rounds, useInteractive)
      setCurrentTopic(topic); setNumRounds(rounds)
      setDebateId(debate.id); setDebateStatus('running')
      setInteractiveMode(useInteractive)
    } catch (e: any) {
      setError(e?.response?.data?.topic?.[0] || 'Failed to start debate. Is the backend running?')
    } finally { setIsLoading(false) }
  }

  const handleStanceSubmit = async (stance: UserStance) => {
    if (!debateId) return
    setStanceSubmitting(true)
    try {
      await debatesApi.submitStance(debateId, stance)
      setAwaitingStance(false)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit stance.')
    } finally {
      setStanceSubmitting(false)
    }
  }

  const handleReset = () => {
    setDebateId(null); setCurrentTopic(''); setError('')
    setDebateStatus('pending'); setCurrentRound(1)
    setAwaitingStance(false)
  }

  return (
    <div className="app-shell min-h-screen flex flex-col">
      <header className="border-b border-slate-800/60 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0 backdrop-blur-sm bg-slate-950/40">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleReset}
            className="text-xl font-bold text-white tracking-tight hover:opacity-80 transition-opacity font-mono shrink-0"
          >
            ⚡ Aria
          </button>
          <span className="text-xs text-slate-600 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800 hidden sm:block font-mono">
            Multi-Agent Debate
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {debateId && <VoiceSelector value={voice} onChange={setVoice} />}
          {debateId && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-white bg-slate-900/60 hover:bg-slate-800/60
                border border-slate-800 px-3 py-1.5 rounded-lg transition-colors font-mono"
            >
              ← New
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0">
        {!debateId && (
          <div className="flex flex-col items-center justify-center flex-1 gap-8 p-4 sm:p-6">
            <div className="text-center max-w-lg">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Drop a topic. Watch AI argue.</h1>
              <p className="text-slate-400 text-base">
                Pick how many rounds you want. Advocate and Critic trade arguments, then a Judge delivers the verdict.
              </p>
              {!user && (
                <p className="text-xs text-slate-600 mt-3">
                  <button type="button" onClick={() => navigate('/auth')} className="text-slate-400 hover:text-white underline">
                    Sign in
                  </button>
                  {' '}to save history and unlock interactive mode.
                </p>
              )}
            </div>

            {user && (
              <div className="w-full max-w-md px-4 py-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20">
                <InteractiveModeToggle
                  enabled={interactiveMode}
                  onChange={setInteractiveMode}
                  disabled={isLoading}
                />
              </div>
            )}

            <TopicInput onStart={handleStart} isLoading={isLoading} />
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-700/40 px-4 py-2 rounded-lg max-w-md text-center">
                {error}
              </p>
            )}
          </div>
        )}

        {debateId && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="shrink-0 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur px-4 sm:px-6 py-3 space-y-2">
              <div className="flex items-center justify-between gap-4 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Debating</p>
                    <span className={clsx('text-[10px] font-semibold font-mono', ROUND_COLORS[numRounds] ?? 'text-slate-400')}>
                      · {numRounds} round{numRounds !== 1 ? 's' : ''}
                    </span>
                    {interactiveMode && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-950/40 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono">
                        Interactive
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-white truncate">&ldquo;{currentTopic}&rdquo;</h2>
                </div>
              </div>
              <DebateStatusBanner status={debateStatus} numRounds={numRounds} currentRound={currentRound} />
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 max-w-4xl mx-auto w-full min-w-0">
              {thread.length === 0 && (
                <div className="flex items-center justify-center h-32 gap-3 text-slate-500 text-sm">
                  <span className="w-4 h-4 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin" />
                  Connecting agents…
                </div>
              )}
              <DebateThread
                thread={thread}
                judgeState={judge}
                scores={scores}
                voiceChoice={voice}
                stanceSlot={showStancePanel ? (
                  <StancePanel onSubmit={handleStanceSubmit} isSubmitting={stanceSubmitting} />
                ) : undefined}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
