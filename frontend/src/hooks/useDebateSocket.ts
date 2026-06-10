import { useEffect, useRef, useCallback, useState } from 'react'
import type { AgentRole, WsMessage, AgentPanelState, JudgeScores } from '@/types'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

const initialPanelState = (): AgentPanelState => ({
  status: 'Waiting...',
  content: '',
  citations: [],
  isDone: false,
  hasError: false,
})

export function useDebateSocket(debateId: string | null) {
  const [advocate, setAdvocate] = useState<AgentPanelState>(initialPanelState())
  const [critic, setCritic] = useState<AgentPanelState>(initialPanelState())
  const [judge, setJudge] = useState<AgentPanelState>(initialPanelState())
  const [scores, setScores] = useState<JudgeScores | null>(null)
  const [isConnected, setIsConnected] = useState(false)

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

  const handleMessage = useCallback((role: AgentRole, msg: WsMessage) => {
    switch (msg.type) {
      case 'connected':
        setIsConnected(true)
        break

      case 'status':
        setPanel(role, (prev) => ({ ...prev, status: msg.content }))
        break

      case 'token':
        setPanel(role, (prev) => ({ ...prev, content: prev.content + msg.content }))
        break

      case 'citation':
        setPanel(role, (prev) => ({
          ...prev,
          citations: [
            ...prev.citations.filter((c) => c.index !== msg.index),
            { index: msg.index, url: msg.url, title: msg.title, snippet: msg.snippet },
          ].sort((a, b) => a.index - b.index),
        }))
        break

      case 'score':
        setScores({
          advocate_evidence: msg.advocate_evidence,
          critic_evidence: msg.critic_evidence,
          advocate_logic: msg.advocate_logic,
          critic_logic: msg.critic_logic,
          verdict: msg.verdict,
        })
        break

      case 'done':
        setPanel(role, (prev) => ({ ...prev, isDone: true, status: 'Done' }))
        break

      case 'error':
        setPanel(role, (prev) => ({
          ...prev,
          hasError: true,
          errorMessage: msg.content,
          status: 'Error',
        }))
        break
    }
  }, [setPanel])

  useEffect(() => {
    if (!debateId) return

    // Reset state for new debate
    setAdvocate(initialPanelState())
    setCritic(initialPanelState())
    setJudge(initialPanelState())
    setScores(null)
    setIsConnected(false)

    const roles: AgentRole[] = ['advocate', 'critic', 'judge']

    roles.forEach((role) => {
      const url = `${WS_BASE}/ws/debate/${debateId}/${role}/`
      const ws = new WebSocket(url)

      ws.onopen = () => {
        console.log(`[${role}] WS connected`)
      }

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data)
          handleMessage(role, msg)
        } catch (e) {
          console.error(`[${role}] Failed to parse WS message`, e)
        }
      }

      ws.onerror = (error) => {
        console.error(`[${role}] WS error`, error)
        setPanel(role, (prev) => ({
          ...prev,
          hasError: true,
          errorMessage: 'WebSocket connection failed',
          status: 'Connection error',
        }))
      }

      ws.onclose = (event) => {
        console.log(`[${role}] WS closed`, event.code)
      }

      sockets.current[role] = ws
    })

    return () => {
      roles.forEach((role) => {
        sockets.current[role]?.close()
        sockets.current[role] = null
      })
    }
  }, [debateId, handleMessage, setPanel])

  return { advocate, critic, judge, scores, isConnected }
}
