import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import type { RoundEntry, Citation, AgentPanelState, JudgeScores } from '@/types'
import { ScoreBoard } from '@/components/ScoreBoard'

// ── Citation helpers ──────────────────────────────────────────────────────────

function CitationBadge({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded
        bg-gray-700 text-gray-300 hover:bg-gray-500 hover:text-white mx-0.5 align-middle transition-colors"
      title={citation.title}
    >
      {citation.index}
    </a>
  )
}

function renderWithCitations(content: string, citations: Citation[]) {
  if (!content) return null
  const parts = content.split(/(\[\d+\])/)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const idx = parseInt(match[1])
      const c = citations.find(c => c.index === idx)
      if (c) return <CitationBadge key={i} citation={c} />
    }
    return <span key={i}>{part}</span>
  })
}

// ── Audio player ──────────────────────────────────────────────────────────────

interface AudioButtonProps {
  text: string
  voice: 'male' | 'female'
  label: string
}

function AudioButton({ text, voice, label }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const togglePlay = () => {
    if (playing) {
      window.speechSynthesis.cancel()
      setPlaying(false)
      return
    }

    setLoading(true)
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, ''))
    utteranceRef.current = utterance

    // Pick voice by gender
    const voices = window.speechSynthesis.getVoices()
    const pick = voices.find(v => {
      const name = v.name.toLowerCase()
      if (voice === 'female') return name.includes('female') || name.includes('woman') || name.includes('samantha') || name.includes('victoria') || name.includes('karen') || name.includes('moira') || name.includes('tessa') || name.includes('fiona') || name.includes('zira')
      return name.includes('male') || name.includes('man') || name.includes('daniel') || name.includes('alex') || name.includes('fred') || name.includes('tom') || name.includes('mark')
    })
    if (pick) utterance.voice = pick
    utterance.rate  = 0.95
    utterance.pitch = voice === 'female' ? 1.1 : 0.9

    utterance.onstart = () => { setLoading(false); setPlaying(true) }
    utterance.onend   = () => setPlaying(false)
    utterance.onerror = () => { setLoading(false); setPlaying(false) }

    window.speechSynthesis.speak(utterance)
  }

  return (
    <button
      onClick={togglePlay}
      title={`${playing ? 'Stop' : 'Listen'} (${label})`}
      className={clsx(
        'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all',
        playing
          ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
          : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500',
      )}
    >
      {loading ? (
        <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
      ) : playing ? (
        <span>⏹</span>
      ) : (
        <span>▶</span>
      )}
      {voice === 'female' ? '♀' : '♂'}
    </button>
  )
}

// ── Source list ───────────────────────────────────────────────────────────────

function SourceList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (!citations.length) return null
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
      >
        <span>{open ? '▾' : '▸'}</span>
        {citations.length} source{citations.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {citations.map(c => (
            <a
              key={c.index}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-[10px] text-gray-500 hover:text-gray-300 transition-colors group"
            >
              <span className="font-mono text-gray-700 group-hover:text-gray-500 shrink-0">[{c.index}]</span>
              <span className="truncate group-hover:underline">{c.title || c.url}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Single round bubble ───────────────────────────────────────────────────────

interface RoundBubbleProps {
  entry: RoundEntry
  voiceChoice: 'male' | 'female'
}

function RoundBubble({ entry, voiceChoice }: RoundBubbleProps) {
  const isAdvocate = entry.role === 'advocate'

  const bubbleRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (entry.isActive && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [entry.content, entry.isActive])

  return (
    <div className={clsx('flex gap-3 w-full', isAdvocate ? 'justify-start' : 'justify-end')}>
      {/* Avatar — advocate left */}
      {isAdvocate && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-sm">🔴</div>
          <span className="text-[9px] text-red-500/70 font-medium">ADV</span>
        </div>
      )}

      <div
        ref={bubbleRef}
        className={clsx(
          'max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all',
          isAdvocate
            ? 'bg-red-950/40 border border-red-500/20 rounded-tl-sm'
            : 'bg-blue-950/40 border border-blue-500/20 rounded-tr-sm',
        )}
      >
        {/* Header */}
        <div className={clsx(
          'flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider',
          isAdvocate ? 'text-red-400' : 'text-blue-400',
        )}>
          <span>{entry.label}</span>
          {entry.isActive && !entry.isDone && (
            <span className={clsx(
              'w-1.5 h-1.5 rounded-full animate-pulse',
              isAdvocate ? 'bg-red-400' : 'bg-blue-400',
            )} />
          )}
          {entry.isDone && <span className="text-green-500">✓</span>}
        </div>

        {/* Content */}
        <p className="text-gray-200 whitespace-pre-wrap">
          {renderWithCitations(entry.content, entry.citations)}
          {entry.isActive && !entry.isDone && (
            <span className={clsx(
              'inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle',
              isAdvocate ? 'bg-red-400' : 'bg-blue-400',
            )} />
          )}
          {!entry.content && entry.isActive && (
            <span className="text-gray-600 italic text-xs">Thinking…</span>
          )}
        </p>

        {/* Footer: sources + audio */}
        <div className="flex items-end justify-between mt-2 gap-2">
          <SourceList citations={entry.citations} />
          {entry.isDone && entry.content && (
            <div className="shrink-0 flex gap-1.5 ml-auto">
              <AudioButton text={entry.content} voice={voiceChoice} label={voiceChoice === 'female' ? 'Female' : 'Male'} />
            </div>
          )}
        </div>
      </div>

      {/* Avatar — critic right */}
      {!isAdvocate && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sm">🔵</div>
          <span className="text-[9px] text-blue-500/70 font-medium">CRIT</span>
        </div>
      )}
    </div>
  )
}

// ── Round separator ───────────────────────────────────────────────────────────

function RoundDivider({ round, label }: { round: number; label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-gray-800" />
      <span className="text-[10px] text-gray-600 font-medium uppercase tracking-widest px-2">
        Round {round} — {label}
      </span>
      <div className="flex-1 h-px bg-gray-800" />
    </div>
  )
}

// ── Judge panel ───────────────────────────────────────────────────────────────

interface JudgePanelProps {
  judgeState: AgentPanelState
  scores: JudgeScores | null
  voiceChoice: 'male' | 'female'
}

function JudgePanel({ judgeState, scores, voiceChoice }: JudgePanelProps) {
  const isActive = !judgeState.isDone && judgeState.status !== 'Waiting…'
  const hasContent = judgeState.content || scores

  if (!hasContent && !isActive) return null

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚖️</span>
        <span className="text-green-400 font-semibold text-sm">Judge</span>
        {isActive && !judgeState.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        )}
        {judgeState.isDone && <span className="text-green-500 text-xs">✓</span>}
        <span className="text-xs text-gray-500 ml-2 italic">{judgeState.status}</span>
      </div>

      {scores && <ScoreBoard scores={scores} />}

      {judgeState.content && (
        <div className="mt-3 bg-green-950/20 border border-green-500/15 rounded-xl px-4 py-3">
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {judgeState.content}
            {!judgeState.isDone && (
              <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
          {judgeState.isDone && judgeState.content && (
            <div className="mt-2 flex justify-end">
              <AudioButton text={judgeState.content} voice={voiceChoice} label={voiceChoice === 'female' ? 'Female' : 'Male'} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Voice selector ────────────────────────────────────────────────────────────

interface VoiceSelectorProps {
  value: 'male' | 'female'
  onChange: (v: 'male' | 'female') => void
}

export function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className="text-gray-600">🔊 Voice:</span>
      {(['female', 'male'] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={clsx(
            'px-2.5 py-1 rounded-full border text-xs transition-all',
            value === v
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400',
          )}
        >
          {v === 'female' ? '♀ Female' : '♂ Male'}
        </button>
      ))}
    </div>
  )
}

// ── Main thread component ─────────────────────────────────────────────────────

interface DebateThreadProps {
  thread: RoundEntry[]
  judgeState: AgentPanelState
  scores: JudgeScores | null
  voiceChoice: 'male' | 'female'
}

const ROUND_PHASE_LABELS: Record<number, string> = {
  1: 'Advocate opens',
  2: 'Critic responds',
  3: 'Advocate rebuts',
  4: 'Critic closes',
}

export function DebateThread({ thread, judgeState, scores, voiceChoice }: DebateThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, scores])

  // Group entries by round for dividers
  const seenRounds = new Set<number>()

  return (
    <div className="flex flex-col gap-4 py-2">
      {thread.map((entry, i) => {
        const showDivider = !seenRounds.has(entry.roundNumber)
        if (showDivider) seenRounds.add(entry.roundNumber)

        return (
          <div key={`${entry.role}-${entry.roundNumber}`}>
            {showDivider && (
              <RoundDivider round={entry.roundNumber} label={ROUND_PHASE_LABELS[entry.roundNumber] ?? ''} />
            )}
            <RoundBubble entry={entry} voiceChoice={voiceChoice} />
          </div>
        )
      })}

      <JudgePanel judgeState={judgeState} scores={scores} voiceChoice={voiceChoice} />
      <div ref={bottomRef} />
    </div>
  )
}
