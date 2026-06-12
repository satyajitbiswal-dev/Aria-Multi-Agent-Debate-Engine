import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'

interface Props {
  onStart: (topic: string, numRounds: number) => void
  isLoading: boolean
}

const ROUND_OPTIONS = [
  { value: 1, label: '1 Round',  sub: 'Quick · 2 turns',  color: 'text-emerald-400', ring: 'ring-emerald-500/40' },
  { value: 2, label: '2 Rounds', sub: 'Default · 4 turns', color: 'text-blue-400',    ring: 'ring-blue-500/40' },
  { value: 3, label: '3 Rounds', sub: 'Deep · 6 turns',   color: 'text-purple-400',  ring: 'ring-purple-500/40' },
  { value: 4, label: '4 Rounds', sub: 'Full · 8 turns',   color: 'text-orange-400',  ring: 'ring-orange-500/40' },
]

export function TopicInput({ onStart, isLoading }: Props) {
  const [topic,      setTopic]      = useState('')
  const [numRounds,  setNumRounds]  = useState(2)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    debatesApi.suggestions().then(d => setSuggestions(d.suggestions)).catch(() => {})
  }, [])

  const handleSubmit = () => {
    if (topic.trim().length < 5 || isLoading) return
    onStart(topic.trim(), numRounds)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const selected = ROUND_OPTIONS.find(o => o.value === numRounds)!

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Topic textarea */}
      <div className="relative">
        <textarea
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Enter a debate topic…"
          rows={2}
          disabled={isLoading}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-28 text-gray-100
            placeholder-gray-500 resize-none focus:outline-none focus:border-gray-500 transition-colors text-sm"
        />
        <button
          onClick={handleSubmit}
          disabled={topic.trim().length < 5 || isLoading}
          className={clsx(
            'absolute right-3 bottom-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            topic.trim().length >= 5 && !isLoading
              ? 'bg-white text-gray-900 hover:bg-gray-200'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed',
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              Starting
            </span>
          ) : 'Debate →'}
        </button>
      </div>

      {/* Round selector */}
      <div>
        <p className="text-xs text-gray-600 mb-2 flex items-center gap-1.5">
          <span>⚡</span> Rounds
          <span className="text-gray-700">— each round = one Advocate turn + one Critic turn</span>
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ROUND_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setNumRounds(opt.value)}
              disabled={isLoading}
              className={clsx(
                'flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border text-center transition-all',
                numRounds === opt.value
                  ? `border-white/20 bg-white/5 ring-1 ${opt.ring}`
                  : 'border-gray-800 bg-gray-900/50 hover:border-gray-700',
              )}
            >
              <span className={clsx('text-sm font-bold', numRounds === opt.value ? opt.color : 'text-gray-400')}>
                {opt.label}
              </span>
              <span className="text-[10px] text-gray-600">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary line */}
      <p className="text-xs text-center text-gray-700">
        {selected.value * 2} total turns →&nbsp;
        <span className={selected.color}>
          {Array.from({ length: selected.value }, (_, i) =>
            `Adv${i+1}→Crit${i+1}`
          ).join(' → ')}
        </span>
        &nbsp;→ Judge
      </p>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && !isLoading && (
        <div>
          <p className="text-xs text-gray-600 mb-2">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map(s => (
              <button
                key={s}
                onClick={() => { setTopic(s); setShowSuggestions(false) }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full
                  transition-colors border border-gray-700 hover:border-gray-500"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
