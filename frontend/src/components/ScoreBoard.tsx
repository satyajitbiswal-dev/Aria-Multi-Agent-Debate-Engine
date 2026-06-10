import { clsx } from 'clsx'
import type { JudgeScores } from '@/types'

interface Props {
  scores: JudgeScores
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round((value / 10) * 100)
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={clsx('font-bold', color)}>{value.toFixed(1)}/10</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-1000', color.replace('text-', 'bg-'))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ScoreBoard({ scores }: Props) {
  const advocateTotal = (scores.advocate_evidence + scores.advocate_logic) / 2
  const criticTotal = (scores.critic_evidence + scores.critic_logic) / 2
  const winner = advocateTotal >= criticTotal ? 'advocate' : 'critic'

  return (
    <div className="bg-gray-900 border border-green-500/30 rounded-xl p-5 mt-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">⚖️</span>
        <h3 className="font-semibold text-green-400 text-sm">Verdict</h3>
      </div>

      {/* Verdict text */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-5">
        <p className="text-gray-200 text-sm leading-relaxed">{scores.verdict}</p>
      </div>

      {/* Score grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Advocate scores */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase tracking-wider">Advocate</span>
            {winner === 'advocate' && (
              <span className="text-xs bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full ml-auto">
                Winner
              </span>
            )}
          </div>
          <div className="space-y-3">
            <ScoreBar label="Evidence" value={scores.advocate_evidence} color="text-red-400" />
            <ScoreBar label="Logic" value={scores.advocate_logic} color="text-red-400" />
          </div>
          <div className="mt-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Overall</span>
              <span className="font-bold text-red-400">{advocateTotal.toFixed(1)}/10</span>
            </div>
          </div>
        </div>

        {/* Critic scores */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs font-medium text-blue-400 uppercase tracking-wider">Critic</span>
            {winner === 'critic' && (
              <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full ml-auto">
                Winner
              </span>
            )}
          </div>
          <div className="space-y-3">
            <ScoreBar label="Evidence" value={scores.critic_evidence} color="text-blue-400" />
            <ScoreBar label="Logic" value={scores.critic_logic} color="text-blue-400" />
          </div>
          <div className="mt-3 pt-2 border-t border-gray-800">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Overall</span>
              <span className="font-bold text-blue-400">{criticTotal.toFixed(1)}/10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
