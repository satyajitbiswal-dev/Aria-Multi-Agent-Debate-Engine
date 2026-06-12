import { useEffect, useRef, useCallback, useState } from 'react'
import type { AgentRole, WsMessage, AgentPanelState, JudgeScores, RoundEntry, Citation } from '@/types'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

const initialPanel = (): AgentPanelState => ({
  status: 'Waiting…', content: '', citations: [], isDone: false, hasError: false,
})

export function useDebateSocket(debateId: string | null) {
  const [advocate, setAdvocate] = useState<AgentPanelState>(initialPanel())
  const [critic,   setCritic]   = useState<AgentPanelState>(initialPanel())
  const [judge,    setJudge]    = useState<AgentPanelState>(initialPanel())
  const [scores,   setScores]   = useState<JudgeScores | null>(null)
  const [thread,   setThread]   = useState<RoundEntry[]>([])

  // Track the current open entry per role (role → {roundNumber, label})
  const openEntry = useRef<Partial<Record<'advocate' | 'critic', { roundNumber: number; label: string }>>>({})

  const sockets = useRef<Record<AgentRole, WebSocket | null>>({ advocate: null, critic: null, judge: null })

  const setPanel = useCallback((role: AgentRole, fn: (p: AgentPanelState) => AgentPanelState) => {
    if (role === 'advocate') setAdvocate(fn)
    else if (role === 'critic') setCritic(fn)
    else setJudge(fn)
  }, [])

  const patchThread = useCallback((role: 'advocate' | 'critic', roundNumber: number, patch: Partial<RoundEntry>) => {
    setThread(prev => {
      const idx = prev.findIndex(e => e.role === role && e.roundNumber === roundNumber)
      if (idx === -1) {
        return [...prev, {
          role, roundNumber,
          label: patch.label ?? `Round ${roundNumber}`,
          content: '', citations: [], isDone: false, isActive: true,
          ...patch,
        } as RoundEntry]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }, [])

  const appendToken = useCallback((role: 'advocate' | 'critic', roundNumber: number, token: string) => {
    setThread(prev => {
      const idx = prev.findIndex(e => e.role === role && e.roundNumber === roundNumber)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = { ...next[idx], content: next[idx].content + token }
      return next
    })
  }, [])

  const addCitation = useCallback((role: 'advocate' | 'critic', roundNumber: number, citation: Citation) => {
    setThread(prev => {
      const idx = prev.findIndex(e => e.role === role && e.roundNumber === roundNumber)
      if (idx === -1) return prev
      const next = [...prev]
      const existing = next[idx].citations.filter(c => c.index !== citation.index)
      next[idx] = { ...next[idx], citations: [...existing, citation].sort((a, b) => a.index - b.index) }
      return next
    })
  }, [])

  const handleMessage = useCallback((role: AgentRole, msg: WsMessage) => {
    switch (msg.type) {

      case 'round_start':
        // Backend explicitly signals a new round — open a fresh bubble
        if (role !== 'judge') {
          const r = role as 'advocate' | 'critic'
          openEntry.current[r] = { roundNumber: msg.round_number, label: msg.label }
          // Mark any previous entry for this role as no longer active
          setThread(prev => prev.map(e =>
            e.role === r && e.isActive ? { ...e, isActive: false } : e
          ))
          patchThread(r, msg.round_number, { label: msg.label, isActive: true })
        }
        break

      case 'status':
        setPanel(role, p => ({ ...p, status: msg.content }))
        break

      case 'token':
        setPanel(role, p => ({ ...p, content: p.content + msg.content }))
        if (role !== 'judge') {
          const open = openEntry.current[role as 'advocate' | 'critic']
          if (open) appendToken(role as 'advocate' | 'critic', open.roundNumber, msg.content)
        }
        break

      case 'citation': {
        const citation: Citation = { index: msg.index, url: msg.url, title: msg.title, snippet: msg.snippet }
        setPanel(role, p => ({
          ...p,
          citations: [...p.citations.filter(c => c.index !== msg.index), citation].sort((a, b) => a.index - b.index),
        }))
        if (role !== 'judge') {
          const open = openEntry.current[role as 'advocate' | 'critic']
          if (open) addCitation(role as 'advocate' | 'critic', open.roundNumber, citation)
        }
        break
      }

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
        setPanel(role, p => ({ ...p, isDone: true, status: 'Done' }))
        if (role !== 'judge') {
          const open = openEntry.current[role as 'advocate' | 'critic']
          if (open) {
            patchThread(role as 'advocate' | 'critic', open.roundNumber, { isDone: true, isActive: false })
          }
        }
        break

      case 'error':
        setPanel(role, p => ({ ...p, hasError: true, errorMessage: msg.content, status: 'Error' }))
        break
    }
  }, [setPanel, patchThread, appendToken, addCitation])

  useEffect(() => {
    if (!debateId) return
    setAdvocate(initialPanel()); setCritic(initialPanel()); setJudge(initialPanel())
    setScores(null); setThread([])
    openEntry.current = {}

    const roles: AgentRole[] = ['advocate', 'critic', 'judge']
    roles.forEach(role => {
      const ws = new WebSocket(`${WS_BASE}/ws/debate/${debateId}/${role}/`)
      ws.onopen = () => console.log(`[${role}] connected`)
      ws.onmessage = ev => {
        try { handleMessage(role, JSON.parse(ev.data)) }
        catch (e) { console.error(`[${role}] parse error`, e) }
      }
      ws.onerror = () => setPanel(role, p => ({
        ...p, hasError: true, errorMessage: 'WebSocket connection failed', status: 'Connection error',
      }))
      ws.onclose = ev => console.log(`[${role}] closed`, ev.code)
      sockets.current[role] = ws
    })

    return () => {
      roles.forEach(role => { sockets.current[role]?.close(); sockets.current[role] = null })
    }
  }, [debateId, handleMessage, setPanel])

  return { advocate, critic, judge, scores, thread }
}
