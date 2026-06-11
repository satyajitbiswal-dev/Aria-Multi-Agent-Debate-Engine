import { clsx } from 'clsx'
import type { DebateStatus } from '@/types'

interface Props {
  status: DebateStatus
}

const PHASES: { key: DebateStatus; label: string; desc: string }[] = [
  { key: 'running',   label: 'Arguing',   desc: 'Advocate & Critic researching in parallel' },
  { key: 'rebuttal',  label: 'Rebuttal',  desc: 'Advocate responds to Critic' },
  { key: 'judging',   label: 'Judging',   desc: 'Judge evaluating both sides' },
  { key: 'completed', label: 'Complete',  desc: 'Verdict delivered' },
]

const ORDER = ['running', 'rebuttal', 'judging', 'completed']

export function DebateStatusBanner({ status }: Props) {
  if (status === 'pending' || status === 'failed') return null

  const currentIndex = ORDER.indexOf(status)

  return (
    <div className="flex items-center justify-center gap-2 text-xs shrink-0">
      {PHASES.map((phase, i) => {
        const phaseIndex = ORDER.indexOf(phase.key)
        const isDone    = phaseIndex < currentIndex
        const isActive  = phaseIndex === currentIndex
        const isPending = phaseIndex > currentIndex

        return (
          <div key={phase.key} className="flex items-center gap-2">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1">
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-all',
                isDone    && 'bg-green-500 text-white',
                isActive  && 'bg-white text-gray-900 ring-2 ring-white/40 animate-pulse',
                isPending && 'bg-gray-800 text-gray-500',
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={clsx(
                'text-xs whitespace-nowrap',
                isDone    && 'text-green-400',
                isActive  && 'text-white font-semibold',
                isPending && 'text-gray-600',
              )}>
                {phase.label}
              </span>
            </div>

            {/* Connector */}
            {i < PHASES.length - 1 && (
              <div className={clsx(
                'w-8 h-px mb-5 transition-all',
                phaseIndex < currentIndex ? 'bg-green-500' : 'bg-gray-700',
              )} />
            )}
          </div>
        )
      })}

      {/* Active phase description */}
      {status !== 'completed' && (
        <span className="ml-4 text-gray-400 italic">
          {PHASES.find(p => p.key === status)?.desc}
        </span>
      )}
    </div>
  )
}
