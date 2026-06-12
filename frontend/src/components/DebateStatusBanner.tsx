import { clsx } from 'clsx'
import type { DebateStatus } from '@/types'

interface Props {
  status: DebateStatus
  numRounds: number
  currentRound?: number  // 1-based, passed from WS progress
}

export function DebateStatusBanner({ status, numRounds, currentRound = 1 }: Props) {
  if (status === 'pending' || status === 'failed') return null

  const isJudging   = status === 'judging'
  const isCompleted = status === 'completed'

  // Build phase list: [R1, R2, …, RN, Judge, Done]
  const phases = [
    ...Array.from({ length: numRounds }, (_, i) => ({
      key: `round_${i + 1}`,
      label: `Round ${i + 1}`,
      sub: i === 0 ? 'Opening' : i === numRounds - 1 ? 'Closing' : 'Rebuttal',
    })),
    { key: 'judging',   label: 'Judge',   sub: 'Deliberating' },
    { key: 'completed', label: 'Verdict', sub: 'Complete' },
  ]

  // Current phase index
  let activeIdx: number
  if (isCompleted)    activeIdx = phases.length - 1
  else if (isJudging) activeIdx = phases.length - 2
  else                activeIdx = (currentRound - 1)   // running → show which round

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-center justify-center gap-0 min-w-max mx-auto">
        {phases.map((phase, i) => {
          const isDone    = i < activeIdx
          const isActive  = i === activeIdx
          const isPending = i > activeIdx

          return (
            <div key={phase.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1 w-16">
                <div className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300',
                  isDone    && 'bg-green-500 text-white',
                  isActive  && 'bg-white text-gray-900 ring-2 ring-white/30 animate-pulse shadow-white/20 shadow-md',
                  isPending && 'bg-gray-900 text-gray-700 border border-gray-800',
                )}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={clsx(
                  'text-[10px] font-medium whitespace-nowrap',
                  isDone    && 'text-green-400',
                  isActive  && 'text-white',
                  isPending && 'text-gray-700',
                )}>
                  {phase.label}
                </span>
                <span className={clsx(
                  'text-[9px] whitespace-nowrap hidden sm:block',
                  isDone    && 'text-green-700',
                  isActive  && 'text-gray-500',
                  isPending && 'text-gray-800',
                )}>
                  {phase.sub}
                </span>
              </div>
              {i < phases.length - 1 && (
                <div className={clsx(
                  'w-4 h-px mb-5 transition-all duration-500 shrink-0',
                  i < activeIdx ? 'bg-green-600' : 'bg-gray-800',
                )} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
