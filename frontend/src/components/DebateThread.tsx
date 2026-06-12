import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import type { RoundEntry, Citation, AgentPanelState, JudgeScores } from '@/types'
import { ScoreBoard } from '@/components/ScoreBoard'
import { useSpeech } from '@/hooks/useSpeech'

// ── Citation helpers ──────────────────────────────────────────────────────────

function CitationBadge({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded
        bg-gray-700 text-gray-300 hover:bg-gray-500 hover:text-white mx-0.5 align-middle transition-colors font-mono"
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

function HighlightedWords({ text, spokenWordIndex }: { text: string; spokenWordIndex: number }) {
  const parts = text.split(/(\s+)/)
  let wordIdx = 0
  return (
    <>
      {parts.map((part, i) => {
        if (!part.trim()) return <span key={i}>{part}</span>
        const idx = wordIdx
        wordIdx += 1
        const cls = idx <= spokenWordIndex ? 'tts-spoken' : 'tts-unspoken'
        return <span key={i} className={cls}>{part}</span>
      })}
    </>
  )
}

// ── Audio player ──────────────────────────────────────────────────────────────

interface AudioButtonProps {
  id: string
  text: string
  voice: 'male' | 'female'
  playingId: string | null
  loadingId: string | null
  onToggle: (id: string, text: string) => void
}

function AudioButton({ id, text, voice, playingId, loadingId, onToggle }: AudioButtonProps) {
  const playing = playingId === id
  const loading = loadingId === id

  return (
    <button
      type="button"
      onClick={() => onToggle(id, text)}
      title={playing ? 'Stop' : 'Listen'}
      className={clsx(
        'flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all font-mono',
        playing
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
          : 'border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-500',
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
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[10px] text-slate-500 hover:text-slate-400 transition-colors flex items-center gap-1"
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
              className="flex items-start gap-2 text-[10px] text-slate-500 hover:text-slate-300 transition-colors group"
            >
              <span className="font-mono text-slate-600 group-hover:text-slate-500 shrink-0">[{c.index}]</span>
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
  speechId: string
  playingId: string | null
  loadingId: string | null
  spokenWordIndex: number
  onToggleSpeech: (id: string, text: string) => void
  stripCitations: (text: string) => string
}

function RoundBubble({
  entry, voiceChoice, speechId, playingId, loadingId, spokenWordIndex, onToggleSpeech, stripCitations,
}: RoundBubbleProps) {
  const isAdvocate = entry.role === 'advocate'
  const isPlayingThis = playingId === speechId
  const cleanText = stripCitations(entry.content)

  const bubbleRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (entry.isActive && bubbleRef.current) {
      bubbleRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [entry.content, entry.isActive])

  return (
    <div className={clsx('flex gap-3 w-full min-w-0', isAdvocate ? 'justify-start' : 'justify-end')}>
      {isAdvocate && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-sm">🔴</div>
          <span className="text-[9px] text-red-500/70 font-medium font-mono">ADV</span>
        </div>
      )}

      <div
        ref={bubbleRef}
        className={clsx(
          'max-w-[85%] sm:max-w-[72%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all',
          isAdvocate
            ? 'bg-red-950/40 border border-red-500/20 rounded-tl-sm'
            : 'bg-blue-950/40 border border-blue-500/20 rounded-tr-sm',
        )}
      >
        <div className={clsx(
          'flex items-center gap-2 mb-2 text-[10px] font-semibold uppercase tracking-wider font-mono',
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

        <p className="text-gray-200 whitespace-pre-wrap break-words">
          {isPlayingThis && entry.content ? (
            <HighlightedWords text={cleanText} spokenWordIndex={spokenWordIndex} />
          ) : (
            renderWithCitations(entry.content, entry.citations)
          )}
          {entry.isActive && !entry.isDone && (
            <span className={clsx(
              'inline-block w-0.5 h-4 ml-0.5 animate-pulse align-middle',
              isAdvocate ? 'bg-red-400' : 'bg-blue-400',
            )} />
          )}
          {!entry.content && entry.isActive && (
            <span className="text-slate-500 italic text-xs">Thinking…</span>
          )}
        </p>

        <div className="flex items-end justify-between mt-2 gap-2">
          <SourceList citations={entry.citations} />
          {entry.isDone && entry.content && (
            <div className="shrink-0 flex gap-1.5 ml-auto">
              <AudioButton
                id={speechId}
                text={entry.content}
                voice={voiceChoice}
                playingId={playingId}
                loadingId={loadingId}
                onToggle={onToggleSpeech}
              />
            </div>
          )}
        </div>
      </div>

      {!isAdvocate && (
        <div className="shrink-0 flex flex-col items-center gap-1 pt-1">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sm">🔵</div>
          <span className="text-[9px] text-blue-500/70 font-medium font-mono">CRIT</span>
        </div>
      )}
    </div>
  )
}

// ── Round separator ───────────────────────────────────────────────────────────

function RoundDivider({ round, label }: { round: number; label: string }) {
  return (
    <div className="flex items-center gap-3 my-2 min-w-0">
      <div className="flex-1 h-px bg-slate-800" />
      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest px-2 font-mono shrink-0">
        Round {round}{label ? ` — ${label}` : ''}
      </span>
      <div className="flex-1 h-px bg-slate-800" />
    </div>
  )
}

// ── Judge panel ───────────────────────────────────────────────────────────────

interface JudgePanelProps {
  judgeState: AgentPanelState
  scores: JudgeScores | null
  voiceChoice: 'male' | 'female'
  playingId: string | null
  loadingId: string | null
  spokenWordIndex: number
  onToggleSpeech: (id: string, text: string) => void
  stripCitations: (text: string) => string
}

function JudgePanel({
  judgeState, scores, voiceChoice, playingId, loadingId, spokenWordIndex, onToggleSpeech, stripCitations,
}: JudgePanelProps) {
  const isActive = !judgeState.isDone && judgeState.status !== 'Waiting…'
  const hasContent = judgeState.content || scores
  const speechId = 'judge-verdict'
  const isPlayingThis = playingId === speechId

  if (!hasContent && !isActive) return null

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⚖️</span>
        <span className="text-green-400 font-semibold text-sm">Judge</span>
        {isActive && !judgeState.isDone && (
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        )}
        {judgeState.isDone && <span className="text-green-500 text-xs">✓</span>}
        <span className="text-xs text-slate-500 ml-2 italic">{judgeState.status}</span>
      </div>

      {scores && <ScoreBoard scores={scores} />}

      {judgeState.content && (
        <div className="mt-3 bg-green-950/20 border border-green-500/15 rounded-xl px-4 py-3">
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {isPlayingThis ? (
              <HighlightedWords
                text={stripCitations(judgeState.content)}
                spokenWordIndex={spokenWordIndex}
              />
            ) : (
              judgeState.content
            )}
            {!judgeState.isDone && (
              <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
          {judgeState.isDone && judgeState.content && (
            <div className="mt-2 flex justify-end">
              <AudioButton
                id={speechId}
                text={judgeState.content}
                voice={voiceChoice}
                playingId={playingId}
                loadingId={loadingId}
                onToggle={onToggleSpeech}
              />
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
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="text-slate-500 font-mono">🔊</span>
      {(['female', 'male'] as const).map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={clsx(
            'px-2.5 py-1 rounded-full border text-xs transition-all font-mono',
            value === v
              ? 'border-white/30 bg-white/10 text-white'
              : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400',
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
  stanceSlot?: React.ReactNode
}

export function DebateThread({ thread, judgeState, scores, voiceChoice, stanceSlot }: DebateThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const { playingId, loadingId, spokenWordIndex, toggle, stripCitations } = useSpeech(voiceChoice)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length, scores, stanceSlot])

  const seenRounds = new Set<number>()
  let stanceInserted = false

  return (
    <div className="flex flex-col gap-4 py-2 min-w-0">
      {thread.map((entry) => {
        const showDivider = !seenRounds.has(entry.roundNumber)
        if (showDivider) seenRounds.add(entry.roundNumber)

        const showStanceAfterRound1 =
          stanceSlot &&
          !stanceInserted &&
          entry.roundNumber === 1 &&
          entry.role === 'critic' &&
          entry.isDone

        if (showStanceAfterRound1) stanceInserted = true

        const speechId = `${entry.role}-${entry.roundNumber}`

        return (
          <div key={`${entry.role}-${entry.roundNumber}`}>
            {showDivider && (
              <RoundDivider round={entry.roundNumber} label={entry.label} />
            )}
            <RoundBubble
              entry={entry}
              voiceChoice={voiceChoice}
              speechId={speechId}
              playingId={playingId}
              loadingId={loadingId}
              spokenWordIndex={spokenWordIndex}
              onToggleSpeech={toggle}
              stripCitations={stripCitations}
            />
            {showStanceAfterRound1 && stanceSlot}
          </div>
        )
      })}

      <JudgePanel
        judgeState={judgeState}
        scores={scores}
        voiceChoice={voiceChoice}
        playingId={playingId}
        loadingId={loadingId}
        spokenWordIndex={spokenWordIndex}
        onToggleSpeech={toggle}
        stripCitations={stripCitations}
      />
      <div ref={bottomRef} />
    </div>
  )
}
