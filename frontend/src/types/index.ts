export type AgentRole = 'advocate' | 'critic' | 'judge'

export type DebateStatus =
  | 'pending'
  | 'running'
  | 'round_2'
  | 'round_3'
  | 'round_4'
  | 'judging'
  | 'completed'
  | 'failed'

export interface Citation {
  id?: string
  index: number
  url: string
  title: string
  snippet: string
}

export interface AgentOutput {
  id: string
  role: AgentRole
  round_number: number
  content: string
  advocate_score?: number
  critic_score?: number
  advocate_logic_score?: number
  critic_logic_score?: number
  verdict?: string
  citations: Citation[]
  created_at: string
}

export interface Debate {
  id: string
  topic: string
  status: DebateStatus
  agent_outputs: AgentOutput[]
  created_at: string
  updated_at: string
}

// WebSocket message types
export type WsMessage =
  | { type: 'connected'; debate_id: string; agent_role: AgentRole }
  | { type: 'token'; content: string }
  | { type: 'status'; content: string }
  | { type: 'citation'; index: number; url: string; title: string; snippet: string }
  | {
      type: 'score'
      advocate_evidence: number
      critic_evidence: number
      advocate_logic: number
      critic_logic: number
      verdict: string
    }
  | { type: 'done' }
  | { type: 'error'; content: string }

// Per-agent panel state
export interface AgentPanelState {
  status: string
  content: string
  citations: Citation[]
  isDone: boolean
  hasError: boolean
  errorMessage?: string
}

export interface JudgeScores {
  advocate_evidence: number
  critic_evidence: number
  advocate_logic: number
  critic_logic: number
  verdict: string
}

// A single round entry in the debate thread
export interface RoundEntry {
  role: 'advocate' | 'critic'
  roundNumber: number
  label: string        // e.g. "Round 1" or "Rebuttal"
  content: string
  citations: Citation[]
  isDone: boolean
  isActive: boolean
}