import { clsx } from 'clsx'
import type { DebateStatus } from '@/types'

interface Props { status: DebateStatus }

const PHASES = [
  { key: 'running',   label: 'Round 1',  sub: 'Advocate opens' },
  { key: 'round_2',   label: 'Round 2',  sub: 'Critic responds' },
  { key: 'round_3',   label: 'Round 3',  sub: 'Advocate rebuts' },
  { key: 'round_4',   label: 'Round 4',  sub: 'Critic closes' },
  { key: 'judging',   label: 'Judging',  sub: 'Judge deliberates' },
  { key: 'completed', label: 'Verdict',  sub: 'Debate complete' },
]

const ORDER = PHASES.map(p => p.key)

export function DebateStatusBanner({ status }: Props) {
  if (status === 'pending' || status === 'failed') return null
  const currentIndex = ORDER.indexOf(status)

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-0">
        {PHASES.map((phase, i) => {
          const phaseIndex = ORDER.indexOf(phase.key)
          const isDone    = phaseIndex < currentIndex
          const isActive  = phaseIndex === currentIndex
          const isPending = phaseIndex > currentIndex

          return (
            <div key={phase.key} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-1 w-20">
                <div className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                  isDone    && 'bg-green-500 text-white',
                  isActive  && 'bg-white text-gray-900 ring-2 ring-white/30 animate-pulse shadow-lg shadow-white/20',
                  isPending && 'bg-gray-800 text-gray-600 border border-gray-700',
                )}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={clsx(
                  'text-[10px] font-semibold whitespace-nowrap',
                  isDone    && 'text-green-400',
                  isActive  && 'text-white',
                  isPending && 'text-gray-700',
                )}>
                  {phase.label}
                </span>
                <span className={clsx(
                  'text-[9px] whitespace-nowrap hidden sm:block',
                  isDone    && 'text-green-600',
                  isActive  && 'text-gray-400',
                  isPending && 'text-gray-800',
                )}>
                  {phase.sub}
                </span>
              </div>

              {/* Connector */}
              {i < PHASES.length - 1 && (
                <div className={clsx(
                  'w-6 h-px mb-6 transition-all duration-500',
                  phaseIndex < currentIndex ? 'bg-green-500' : 'bg-gray-800',
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
