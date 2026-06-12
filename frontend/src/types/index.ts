export type AgentRole = 'advocate' | 'critic' | 'judge'

export type DebateStatus = 'pending' | 'running' | 'judging' | 'completed' | 'failed'

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
  turn: string
  content: string
  advocate_score?: number
  critic_score?: number
  advocate_logic_score?: number
  critic_logic_score?: number
  verdict?: string
  citations: Citation[]
  created_at: string
}

export type UserStance = 'advocate' | 'critic'

export interface Debate {
  id: string
  topic: string
  num_rounds: number
  status: DebateStatus
  interactive_mode?: boolean
  user_stance?: string
  awaiting_stance?: boolean
  agent_outputs: AgentOutput[]
  created_at: string
  updated_at: string
}

export type WsMessage =
  | { type: 'connected';   debate_id: string; agent_role: AgentRole }
  | { type: 'token';       content: string }
  | { type: 'status';      content: string }
  | { type: 'round_start'; round_number: number; label: string }
  | { type: 'citation';    index: number; url: string; title: string; snippet: string }
  | { type: 'score';       advocate_evidence: number; critic_evidence: number; advocate_logic: number; critic_logic: number; verdict: string }
  | { type: 'done' }
  | { type: 'error';       content: string }

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

export interface RoundEntry {
  role: 'advocate' | 'critic'
  roundNumber: number
  label: string
  content: string
  citations: Citation[]
  isDone: boolean
  isActive: boolean
}

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  avatar: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
}
