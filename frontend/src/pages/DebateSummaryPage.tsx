import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'
import { ExportButton } from '@/components/ExportButton'
import { ScoreBoard } from '@/components/ScoreBoard'
import type { Debate, AgentOutput, Citation } from '@/types'

const ROLE_CONFIG = {
  advocate: { emoji: '🔴', label: 'Advocate', color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-950/30', side: 'left' },
  critic:   { emoji: '🔵', label: 'Critic',   color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-950/30', side: 'right' },
  judge:    { emoji: '⚖️',  label: 'Judge',    color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-950/20', side: 'center' },
} as const

const ROUND_LABELS: Record<number, string> = { 1: 'Opening', 2: 'Counter', 3: 'Rebuttal', 4: 'Final Word' }

function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(o => !o)} className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-1">
        <span>{open ? '▾' : '▸'}</span>{citations.length} source{citations.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {citations.map(c => (
            <a key={c.index} href={c.url} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-2 text-[10px] text-gray-500 hover:text-gray-300 group">
              <span className="font-mono text-gray-700 group-hover:text-gray-500 shrink-0">[{c.index}]</span>
              <span className="truncate group-hover:underline">{c.title || c.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function OutputCard({ output }: { output: AgentOutput }) {
  const cfg = ROLE_CONFIG[output.role]
  const isAdvocate = output.role === 'advocate'
  const isCritic   = output.role === 'critic'
  const isJudge    = output.role === 'judge'
  const label = output.role === 'judge' ? 'Analysis' : (ROUND_LABELS[output.round_number] ?? `Round ${output.round_number}`)

  if (isJudge) {
    return (
      <div className={clsx('rounded-xl border p-4', cfg.border, cfg.bg)}>
        <div className="flex items-center gap-2 mb-2">
          <span>{cfg.emoji}</span>
          <span className={clsx('font-semibold text-sm', cfg.color)}>{cfg.label} — {label}</span>
        </div>
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{output.content || '(no output)'}</p>
        <CitationList citations={output.citations ?? []} />
      </div>
    )
  }

  return (
    <div className={clsx('flex gap-3', isCritic && 'justify-end')}>
      {isAdvocate && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-sm">🔴</div>
          <span className="text-[9px] text-red-500/60">ADV</span>
        </div>
      )}
      <div className={clsx(
        'max-w-[72%] rounded-2xl px-4 py-3 border',
        isAdvocate ? 'bg-red-950/40 border-red-500/20 rounded-tl-sm' : 'bg-blue-950/40 border-blue-500/20 rounded-tr-sm',
      )}>
        <div className={clsx('text-[10px] font-semibold uppercase tracking-wider mb-1.5', isAdvocate ? 'text-red-400' : 'text-blue-400')}>
          {label}
        </div>
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{output.content || '(no output)'}</p>
        <CitationList citations={output.citations ?? []} />
      </div>
      {isCritic && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sm">🔵</div>
          <span className="text-[9px] text-blue-500/60">CRIT</span>
        </div>
      )}
    </div>
  )
}

function RoundDivider({ round }: { round: number }) {
  const labels: Record<number, string> = { 1: 'Advocate opens', 2: 'Critic responds', 3: 'Advocate rebuts', 4: 'Critic closes' }
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-gray-800" />
      <span className="text-[10px] text-gray-700 uppercase tracking-widest">Round {round} — {labels[round] ?? ''}</span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  )
}

export function DebateSummaryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [debate, setDebate] = useState<Debate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    debatesApi.get(id).then(setDebate).catch(() => setError('Debate not found.')).finally(() => setLoading(false))
  }, [id])

  const judgeOutput = debate?.agent_outputs?.find(o => o.role === 'judge')
  const scores = judgeOutput && judgeOutput.advocate_score != null ? {
    advocate_evidence: judgeOutput.advocate_score,
    critic_evidence:   judgeOutput.critic_score ?? 0,
    advocate_logic:    judgeOutput.advocate_logic_score ?? 0,
    critic_logic:      judgeOutput.critic_logic_score ?? 0,
    verdict:           judgeOutput.verdict ?? '',
  } : null

  // Sort: advocate-1, critic-2, advocate-3, critic-4, judge-1
  const debateRounds = debate?.agent_outputs
    ?.filter(o => o.role !== 'judge')
    .sort((a, b) => a.round_number - b.round_number) ?? []
  const judgeOutputSorted = debate?.agent_outputs?.filter(o => o.role === 'judge') ?? []

  const seenRounds = new Set<number>()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-500 hover:text-white transition-colors text-sm">← Home</button>
          <span className="text-gray-800">|</span>
          <span className="text-white font-semibold text-sm">⚡ Aria</span>
        </div>
        {debate?.status === 'completed' && id && (
          <ExportButton debateId={id} topic={debate.topic} />
        )}
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-6">
        {loading && (
          <div className="space-y-4">
            <div className="h-8 w-2/3 bg-gray-900 rounded animate-pulse mx-auto" />
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-900 rounded-xl animate-pulse" />)}
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-white">Go home</button>
          </div>
        )}
        {!loading && debate && (
          <>
            <div className="text-center mb-6">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Debate</p>
              <h1 className="text-xl font-bold text-white mb-2">"{debate.topic}"</h1>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
                <span>{new Date(debate.created_at).toLocaleString()}</span>
                <span>·</span>
                <span className={clsx('px-2 py-0.5 rounded-full font-medium',
                  debate.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                )}>
                  {debate.status}
                </span>
              </div>
            </div>

            {scores && <div className="mb-6"><ScoreBoard scores={scores} /></div>}

            {debate.status !== 'completed' && (
              <div className="mb-5 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300 text-center">
                Debate in progress ({debate.status}). Check back shortly.
              </div>
            )}

            <div className="space-y-3">
              {debateRounds.map(output => {
                const showDiv = !seenRounds.has(output.round_number)
                if (showDiv) seenRounds.add(output.round_number)
                return (
                  <div key={output.id}>
                    {showDiv && <RoundDivider round={output.round_number} />}
                    <OutputCard output={output} />
                  </div>
                )
              })}

              {judgeOutputSorted.map(output => (
                <div key={output.id}>
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-[10px] text-gray-700 uppercase tracking-widest">Judge's Verdict</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                  <OutputCard output={output} />
                </div>
              ))}
            </div>

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
