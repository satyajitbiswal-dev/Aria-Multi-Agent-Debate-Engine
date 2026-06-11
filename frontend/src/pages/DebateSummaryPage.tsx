import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'
import { ExportButton } from '@/components/ExportButton'
import { ScoreBoard } from '@/components/ScoreBoard'
import type { Debate, AgentOutput, Citation } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  advocate: { emoji: '🔴', label: 'Advocate', color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  critic:   { emoji: '🔵', label: 'Critic',   color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
  judge:    { emoji: '⚖️',  label: 'Judge',    color: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/5' },
} as const

function CitationCard({ c }: { c: Citation }) {
  return (
    <a
      href={c.url} target="_blank" rel="noopener noreferrer"
      className="block text-xs bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 mt-1.5 hover:border-gray-500 transition-colors"
    >
      <span className="text-gray-500 font-mono mr-2">[{c.index}]</span>
      <span className="text-gray-300">{c.title || c.url}</span>
    </a>
  )
}

function OutputCard({ output }: { output: AgentOutput }) {
  const cfg = ROLE_CONFIG[output.role]
  const roundLabel = output.round_number === 2 ? ' — Rebuttal' : ''

  return (
    <div className={clsx('rounded-xl border p-5', cfg.border, cfg.bg)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{cfg.emoji}</span>
        <span className={clsx('font-semibold text-sm', cfg.color)}>
          {cfg.label}{roundLabel}
        </span>
      </div>
      <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
        {output.content || '(no output)'}
      </p>
      {output.citations?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">Sources</p>
          {output.citations.map((c) => <CitationCard key={c.index} c={c} />)}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-3">
      <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={clsx('h-3 bg-gray-800 rounded animate-pulse', i === 4 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DebateSummaryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [debate, setDebate] = useState<Debate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    debatesApi.get(id)
      .then(setDebate)
      .catch(() => setError('Debate not found.'))
      .finally(() => setLoading(false))
  }, [id])

  // Build judge scores from stored AgentOutput
  const judgeOutput = debate?.agent_outputs?.find(o => o.role === 'judge')
  const scores = judgeOutput && judgeOutput.advocate_score != null ? {
    advocate_evidence: judgeOutput.advocate_score,
    critic_evidence:   judgeOutput.critic_score ?? 0,
    advocate_logic:    judgeOutput.advocate_logic_score ?? 0,
    critic_logic:      judgeOutput.critic_logic_score ?? 0,
    verdict:           judgeOutput.verdict ?? '',
  } : null

  // Sort outputs: advocate-1, critic-1, advocate-2, judge-1
  const ordered = debate?.agent_outputs?.slice().sort((a, b) => {
    const priority = { advocate: 0, critic: 1, judge: 2 }
    if (a.role !== b.role) return priority[a.role] - priority[b.role]
    return a.round_number - b.round_number
  }) ?? []

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            ← Home
          </button>
          <span className="text-gray-700">|</span>
          <span className="text-white font-semibold text-sm">⚡ Aria</span>
        </div>
        {debate?.status === 'completed' && id && (
          <ExportButton debateId={id} topic={debate.topic} />
        )}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-gray-800 rounded animate-pulse mx-auto" />
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-red-400 text-lg mb-4">{error}</p>
            <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white">
              Go home
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && debate && (
          <>
            {/* Topic */}
            <div className="text-center mb-8">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Debate</p>
              <h1 className="text-2xl font-bold text-white mb-2">"{debate.topic}"</h1>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
                <span>{new Date(debate.created_at).toLocaleString()}</span>
                <span>·</span>
                <span className={clsx(
                  'px-2 py-0.5 rounded-full font-medium',
                  debate.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                )}>
                  {debate.status}
                </span>
              </div>
            </div>

            {/* Scores at top if completed */}
            {scores && (
              <div className="mb-8">
                <ScoreBoard scores={scores} />
              </div>
            )}

            {/* Agent outputs */}
            {debate.status !== 'completed' && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-sm text-yellow-300 text-center">
                This debate is still in progress ({debate.status}). Check back shortly for the full transcript.
              </div>
            )}

            <div className="space-y-5">
              {ordered.map((output) => (
                <OutputCard key={output.id} output={output} />
              ))}
            </div>

            {/* Export row at bottom */}
            {debate.status === 'completed' && id && (
              <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end">
                <ExportButton debateId={id} topic={debate.topic} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
