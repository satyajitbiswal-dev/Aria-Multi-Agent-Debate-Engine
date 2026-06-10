import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import type { AgentPanelState, AgentRole, Citation } from '@/types'

interface Props {
  role: AgentRole
  state: AgentPanelState
}

const ROLE_CONFIG = {
  advocate: {
    label: 'Advocate',
    emoji: '🔴',
    tagline: 'Argues FOR',
    color: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    statusDot: 'bg-red-400',
    badgeBg: 'bg-red-500/20 text-red-300',
  },
  critic: {
    label: 'Critic',
    emoji: '🔵',
    tagline: 'Argues AGAINST',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    statusDot: 'bg-blue-400',
    badgeBg: 'bg-blue-500/20 text-blue-300',
  },
  judge: {
    label: 'Judge',
    emoji: '⚖️',
    tagline: 'Evaluates',
    color: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    statusDot: 'bg-green-400',
    badgeBg: 'bg-green-500/20 text-green-300',
  },
} as const

function CitationCard({ citation }: { citation: Citation }) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block text-xs bg-gray-900/80 border border-gray-700/60 rounded-lg px-3 py-2 mt-1.5 hover:border-gray-500 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="text-gray-500 font-mono shrink-0">[{citation.index}]</span>
        <div className="min-w-0">
          <p className="text-gray-300 font-medium truncate group-hover:text-white transition-colors">
            {citation.title || citation.url}
          </p>
          {citation.snippet && (
            <p className="text-gray-500 mt-0.5 line-clamp-2">{citation.snippet}</p>
          )}
        </div>
      </div>
    </a>
  )
}

function StatusBar({ status, isDone, hasError, config }: {
  status: string
  isDone: boolean
  hasError: boolean
  config: typeof ROLE_CONFIG[AgentRole]
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
      {!isDone && !hasError && (
        <span className={clsx('status-dot', config.statusDot)} />
      )}
      {isDone && <span className="text-green-400">✓</span>}
      {hasError && <span className="text-red-400">✗</span>}
      <span className={clsx({ 'text-green-400': isDone, 'text-red-400': hasError })}>
        {status}
      </span>
    </div>
  )
}

// Replace inline citation markers [1], [2] with styled badges
function renderContentWithCitations(content: string, citations: Citation[]) {
  if (!content) return null
  const parts = content.split(/(\[\d+\])/)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const idx = parseInt(match[1])
      const citation = citations.find((c) => c.index === idx)
      if (citation) {
        return (
          <a
            key={i}
            href={citation.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded bg-gray-700 text-gray-300 hover:bg-gray-600 mx-0.5 align-middle"
            title={citation.title}
          >
            {idx}
          </a>
        )
      }
    }
    return <span key={i}>{part}</span>
  })
}

export function AgentPanel({ role, state }: Props) {
  const config = ROLE_CONFIG[role]
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-scroll as tokens arrive
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [state.content])

  return (
    <div className={clsx(
      'flex flex-col rounded-xl border h-full min-h-0',
      config.border, config.bg
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.emoji}</span>
          <div>
            <h3 className={clsx('font-semibold text-sm', config.color)}>
              {config.label}
            </h3>
            <p className="text-gray-500 text-xs">{config.tagline}</p>
          </div>
        </div>
        {state.citations.length > 0 && (
          <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', config.badgeBg)}>
            {state.citations.length} sources
          </span>
        )}
      </div>

      {/* Status bar */}
      <div className="px-4 pt-3">
        <StatusBar
          status={state.status}
          isDone={state.isDone}
          hasError={state.hasError}
          config={config}
        />
      </div>

      {/* Streaming content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 pb-2 min-h-0"
      >
        {state.content ? (
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {renderContentWithCitations(state.content, state.citations)}
            {!state.isDone && (
              <span className="inline-block w-0.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        ) : (
          <div className="space-y-2 mt-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'h-3 rounded-full bg-gray-800 animate-pulse',
                  i === 3 ? 'w-2/3' : 'w-full'
                )}
              />
            ))}
          </div>
        )}

        {state.hasError && (
          <div className="mt-3 p-3 bg-red-900/20 border border-red-700/40 rounded-lg">
            <p className="text-red-400 text-xs">{state.errorMessage}</p>
          </div>
        )}
      </div>

      {/* Citations */}
      {state.citations.length > 0 && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wider">
            Sources
          </p>
          {state.citations.map((c) => (
            <CitationCard key={c.index} citation={c} />
          ))}
        </div>
      )}
    </div>
  )
}
