import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { debatesApi } from '@/lib/api'

interface Props {
  onStart: (topic: string, numRounds: number) => void
  isLoading: boolean
}

const ROUND_OPTIONS = [
  { value: 1, label: '1 Round',  sub: 'Quick · 2 turns',   accent: 'text-emerald-400', ring: 'ring-emerald-500/40', bg: 'bg-emerald-500/5' },
  { value: 2, label: '2 Rounds', sub: 'Default · 4 turns',  accent: 'text-blue-400',    ring: 'ring-blue-500/40',    bg: 'bg-blue-500/5' },
  { value: 3, label: '3 Rounds', sub: 'Deep · 6 turns',     accent: 'text-purple-400',  ring: 'ring-purple-500/40',  bg: 'bg-purple-500/5' },
  { value: 4, label: '4 Rounds', sub: 'Full · 8 turns',     accent: 'text-orange-400',  ring: 'ring-orange-500/40',  bg: 'bg-orange-500/5' },
]

// ── Topic improve banner ──────────────────────────────────────────────────────
interface ImproveBannerProps {
  original:    string
  improved:    string
  explanation: string
  onAccept:    () => void
  onDismiss:   () => void
}

function ImproveBanner({ original, improved, explanation, onAccept, onDismiss }: ImproveBannerProps) {
  return (
    <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3 space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-semibold">
          <span>✨</span> Suggested improvement
        </div>
        <button onClick={onDismiss} className="text-gray-600 hover:text-gray-400 text-xs">✕</button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-0.5">
          <p className="text-gray-600 uppercase tracking-wider text-[10px]">Original</p>
          <p className="text-gray-400 line-through">{original}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-yellow-500/70 uppercase tracking-wider text-[10px]">Improved</p>
          <p className="text-gray-100 font-medium">{improved}</p>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 italic">{explanation}</p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAccept}
          className="flex-1 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30
            text-yellow-300 text-xs font-medium py-1.5 rounded-lg transition-all"
        >
          Use improved version
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700
            text-gray-400 text-xs py-1.5 rounded-lg transition-all"
        >
          Keep original
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function TopicInput({ onStart, isLoading }: Props) {
  const [topic,       setTopic]       = useState('')
  const [numRounds,   setNumRounds]   = useState(2)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggest, setShowSuggest] = useState(false)

  // Improve topic state
  const [improving,   setImproving]   = useState(false)
  const [improvement, setImprovement] = useState<{ original: string; improved: string; explanation: string } | null>(null)
  const improveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    debatesApi.suggestions().then(d => setSuggestions(d.suggestions)).catch(() => {})
  }, [])

  // Auto-trigger improvement after user stops typing for 1.5s (only if topic is decent length)
  useEffect(() => {
    if (improveTimer.current) clearTimeout(improveTimer.current)
    setImprovement(null)

    if (topic.trim().length < 10 || isLoading) return

    improveTimer.current = setTimeout(async () => {
      setImproving(true)
      try {
        const result = await debatesApi.improveTopic(topic.trim())
        // Only show banner if suggestion is actually different
        if (result.improved.toLowerCase().trim() !== topic.toLowerCase().trim()) {
          setImprovement(result)
        }
      } catch { /* silent fail — don't block the user */ }
      finally { setImproving(false) }
    }, 1500)

    return () => { if (improveTimer.current) clearTimeout(improveTimer.current) }
  }, [topic])

  const handleSubmit = (topicOverride?: string) => {
    const t = (topicOverride ?? topic).trim()
    if (t.length < 5 || isLoading) return
    setImprovement(null)
    onStart(t, numRounds)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const selected = ROUND_OPTIONS.find(o => o.value === numRounds)!

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Topic textarea */}
      <div className="relative">
        <textarea
          value={topic}
          onChange={e => { setTopic(e.target.value); setImprovement(null) }}
          onKeyDown={handleKey}
          onFocus={() => setShowSuggest(true)}
          placeholder="Enter a debate topic…"
          rows={2}
          disabled={isLoading}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 pr-28
            text-gray-100 placeholder-gray-500 resize-none focus:outline-none
            focus:border-gray-500 transition-colors text-sm"
        />
        {/* Improving spinner */}
        {improving && (
          <span className="absolute left-4 bottom-3.5 flex items-center gap-1.5 text-[10px] text-yellow-500/70">
            <span className="w-2.5 h-2.5 border border-yellow-500/50 border-t-yellow-400 rounded-full animate-spin" />
            Improving…
          </span>
        )}
        <button
          onClick={() => handleSubmit()}
          disabled={topic.trim().length < 5 || isLoading}
          className={clsx(
            'absolute right-3 bottom-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            topic.trim().length >= 5 && !isLoading
              ? 'bg-white text-gray-900 hover:bg-gray-200'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed',
          )}
        >
          {isLoading
            ? <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
                Starting
              </span>
            : 'Debate →'
          }
        </button>
      </div>

      {/* Improvement banner */}
      {improvement && (
        <ImproveBanner
          {...improvement}
          onAccept={() => {
            setTopic(improvement.improved)
            setImprovement(null)
          }}
          onDismiss={() => setImprovement(null)}
        />
      )}

      {/* Round selector */}
      <div>
        <p className="text-[10px] text-gray-600 mb-2 flex items-center gap-1.5">
          <span>⚡</span>
          <span className="uppercase tracking-wider">Rounds</span>
          <span className="text-gray-800">— each round = one Advocate turn + one Critic turn</span>
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
                  ? `border-white/15 ${opt.bg} ring-1 ${opt.ring}`
                  : 'border-gray-800 bg-gray-900/40 hover:border-gray-700',
              )}
            >
              <span className={clsx('text-sm font-bold', numRounds === opt.value ? opt.accent : 'text-gray-500')}>
                {opt.label}
              </span>
              <span className="text-[10px] text-gray-700">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Flow preview */}
      <p className="text-[10px] text-center text-gray-700">
        {Array.from({ length: numRounds }, (_, i) => `Adv${i+1}↔Crit${i+1}`).join(' → ')}
        {' → '}
        <span className="text-green-700">Judge</span>
      </p>

      {/* Suggestions */}
      {showSuggest && suggestions.length > 0 && !isLoading && (
        <div>
          <p className="text-[10px] text-gray-600 mb-1.5">Try one of these:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map(s => (
              <button
                key={s}
                onClick={() => { setTopic(s); setShowSuggest(false) }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5
                  rounded-full transition-colors border border-gray-700 hover:border-gray-500"
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
