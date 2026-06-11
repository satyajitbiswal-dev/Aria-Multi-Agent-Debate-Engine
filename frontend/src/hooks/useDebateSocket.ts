import { useEffect, useRef, useCallback, useState } from 'react'
import type { AgentRole, WsMessage, AgentPanelState, JudgeScores, RoundEntry, Citation } from '@/types'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

const initialPanelState = (): AgentPanelState => ({
  status: 'Waiting…',
  content: '',
  citations: [],
  isDone: false,
  hasError: false,
})

// Maps debate status → which (role, roundNumber) is currently streaming
const STATUS_TO_ACTIVE: Record<string, { role: AgentRole; round: number } | null> = {
  running:   { role: 'advocate', round: 1 },
  round_2:   { role: 'critic',   round: 2 },
  round_3:   { role: 'advocate', round: 3 },
  round_4:   { role: 'critic',   round: 4 },
  judging:   null,
  completed: null,
  failed:    null,
}

// Round labels
const ROUND_LABELS: Record<number, string> = {
  1: 'Opening',
  2: 'Counter',
  3: 'Rebuttal',
  4: 'Final Word',
}

export function useDebateSocket(debateId: string | null) {
  const [advocate, setAdvocate] = useState<AgentPanelState>(initialPanelState())
  const [critic,   setCritic]   = useState<AgentPanelState>(initialPanelState())
  const [judge,    setJudge]    = useState<AgentPanelState>(initialPanelState())
  const [scores,   setScores]   = useState<JudgeScores | null>(null)

  // Thread holds completed + in-progress rounds in order
  const [thread, setThread] = useState<RoundEntry[]>([])

  // Track which (role,round) pair is currently accumulating
  const activeEntry = useRef<{ role: AgentRole; round: number } | null>(null)

  const sockets = useRef<Record<AgentRole, WebSocket | null>>({
    advocate: null,
    critic: null,
    judge: null,
  })

  const setPanel = useCallback((role: AgentRole, updater: (prev: AgentPanelState) => AgentPanelState) => {
    if (role === 'advocate') setAdvocate(updater)
    else if (role === 'critic') setCritic(updater)
    else setJudge(updater)
  }, [])

  // Upsert a thread entry by (role, roundNumber)
  const upsertThread = useCallback((role: 'advocate' | 'critic', roundNumber: number, patch: Partial<RoundEntry>) => {
    setThread(prev => {
      const idx = prev.findIndex(e => e.role === role && e.roundNumber === roundNumber)
      if (idx === -1) {
        const newEntry: RoundEntry = {
          role,
          roundNumber,
          label: ROUND_LABELS[roundNumber] ?? `Round ${roundNumber}`,
          content: '',
          citations: [],
          isDone: false,
          isActive: true,
          ...patch,
        }
        return [...prev, newEntry]
      }
      const updated = [...prev]
      updated[idx] = { ...updated[idx], ...patch }
      return updated
    })
  }, [])

  const handleMessage = useCallback((role: AgentRole, msg: WsMessage) => {
    switch (msg.type) {
      case 'status':
        setPanel(role, prev => ({ ...prev, status: msg.content }))
        // Parse round number from status message e.g. "Round 3 – Writing argument…"
        if (role !== 'judge') {
          const m = msg.content.match(/Round (\d+)/)
          if (m) {
            const rn = parseInt(m[1])
            activeEntry.current = { role: role as 'advocate' | 'critic', round: rn }
            upsertThread(role as 'advocate' | 'critic', rn, { isActive: true, status: msg.content })
          }
        }
        break

      case 'token':
        setPanel(role, prev => ({ ...prev, content: prev.content + msg.content }))
        if (role !== 'judge' && activeEntry.current?.role === role) {
          const rn = activeEntry.current.round
          upsertThread(role as 'advocate' | 'critic', rn, {})
          setThread(prev => {
            const idx = prev.findIndex(e => e.role === role && e.roundNumber === rn)
            if (idx === -1) return prev
            const updated = [...prev]
            updated[idx] = { ...updated[idx], content: updated[idx].content + msg.content }
            return updated
          })
        }
        break

      case 'citation':
        setPanel(role, prev => ({
          ...prev,
          citations: [
            ...prev.citations.filter(c => c.index !== msg.index),
            { index: msg.index, url: msg.url, title: msg.title, snippet: msg.snippet },
          ].sort((a, b) => a.index - b.index),
        }))
        if (role !== 'judge' && activeEntry.current?.role === role) {
          const rn = activeEntry.current.round
          const citation: Citation = { index: msg.index, url: msg.url, title: msg.title, snippet: msg.snippet }
          setThread(prev => {
            const idx = prev.findIndex(e => e.role === role && e.roundNumber === rn)
            if (idx === -1) return prev
            const updated = [...prev]
            const existing = updated[idx].citations.filter(c => c.index !== msg.index)
            updated[idx] = { ...updated[idx], citations: [...existing, citation].sort((a,b) => a.index - b.index) }
            return updated
          })
        }
        break

      case 'score':
        setScores({
          advocate_evidence: msg.advocate_evidence,
          critic_evidence:   msg.critic_evidence,
          advocate_logic:    msg.advocate_logic,
          critic_logic:      msg.critic_logic,
          verdict:           msg.verdict,
        })
        break

      case 'done':
        setPanel(role, prev => ({ ...prev, isDone: true, status: 'Done' }))
        if (role !== 'judge' && activeEntry.current?.role === role) {
          const rn = activeEntry.current.round
          setThread(prev => {
            const idx = prev.findIndex(e => e.role === role && e.roundNumber === rn)
            if (idx === -1) return prev
            const updated = [...prev]
            updated[idx] = { ...updated[idx], isDone: true, isActive: false }
            return updated
          })
        }
        break

      case 'error':
        setPanel(role, prev => ({
          ...prev,
          hasError: true,
          errorMessage: msg.content,
          status: 'Error',
        }))
        break
    }
  }, [setPanel, upsertThread])

  useEffect(() => {
    if (!debateId) return
    setAdvocate(initialPanelState())
    setCritic(initialPanelState())
    setJudge(initialPanelState())
    setScores(null)
    setThread([])
    activeEntry.current = null

    const roles: AgentRole[] = ['advocate', 'critic', 'judge']
    roles.forEach(role => {
      const url = `${WS_BASE}/ws/debate/${debateId}/${role}/`
      const ws = new WebSocket(url)
      ws.onopen = () => console.log(`[${role}] WS connected`)
      ws.onmessage = event => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          handleMessage(role, msg)
        } catch (e) {
          console.error(`[${role}] parse error`, e)
        }
      }
      ws.onerror = () => setPanel(role, prev => ({
        ...prev, hasError: true, errorMessage: 'WebSocket connection failed', status: 'Connection error',
      }))
      ws.onclose = event => console.log(`[${role}] WS closed`, event.code)
      sockets.current[role] = ws
    })

    return () => {
      roles.forEach(role => { sockets.current[role]?.close(); sockets.current[role] = null })
    }
  }, [debateId, handleMessage, setPanel])

  return { advocate, critic, judge, scores, thread }
}
