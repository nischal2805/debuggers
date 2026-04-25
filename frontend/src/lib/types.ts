// ─── Brain model ──────────────────────────────────────────────────────────────

export interface TopicStat {
  // 5D dimensions
  knowledge: number
  speed: number
  confidence: number
  consistency: number
  patternRecognition: number
  // alias kept in sync with knowledge
  mastery: number

  attempts: number
  correct: number
  avgTimeMs: number
  lastSeen: string | null
  lastSeenQuestionIndex?: number
  questionsSinceSeen?: number

  // behavior signals
  hesitationCount: number
  hintRequests: number
  overconfidenceFlags?: number
  surfaceKnowledgeFlags?: number
  skipCount?: number
  hintAvoidanceCount?: number

  misconceptionHistogram?: Record<string, number>
}

export interface PatternStat {
  knowledge: number
  speed: number
  confidence: number
  consistency: number
  attempts: number
  correct: number
}

export interface ReadinessSnapshot {
  total: number
  coverage: number
  accuracy: number
  speed: number
  consistency: number
  recency: number
  timestamp: string | null
}

export interface AgentStateSnapshot {
  lastMode: string
  lastReason: string
  lastTopic: string
  queueSnapshot: PriorityQueueEntry[]
  pendingReview: string[]
  recapMemory: string[]
}

export interface KnowledgeModel {
  uid: string
  topics: Record<string, TopicStat>
  patternStats?: Record<string, PatternStat>
  learningStyle: 'visual' | 'analytical' | 'trial-error'
  pacePreference: 'fast' | 'slow' | 'adaptive'
  currentFocus: string
  weaknessVector: string[]
  strengthVector: string[]
  sessionCount: number
  totalMinutes: number
  questionCounter?: number
  readiness?: ReadinessSnapshot
  readinessHistory?: { total: number; timestamp: string }[]
  agentState?: AgentStateSnapshot
}

// ─── User profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string
  email: string
  name: string
  photoURL: string
  goal?: 'placement' | 'faang' | 'competitive' | 'learning'
  dailyGoalMinutes?: number
  onboarded?: boolean
}

// ─── Tutor / WS ──────────────────────────────────────────────────────────────

export type AgentMode = 'ASSESS' | 'SCAFFOLD' | 'REINFORCE' | 'ADVANCE' | 'EXPLAIN' | 'CONTINUE'

export interface OptimalityScore {
  time_complexity: number
  space_complexity: number
  code_clarity: number
  overall_optimality: number
}

export interface EvaluationResult {
  correct: boolean
  partial_credit: number
  feedback: string
  errors: string[]
  hint_for_retry: string | null
  error_fingerprint?: string | null
  optimality_score?: OptimalityScore | null
}

export interface PriorityQueueEntry {
  topic: string
  score: number
  level: number
  reasons: Record<string, number>
}

export interface ReportCard {
  headline: string
  strongest_concept: string
  biggest_gap: string
  recurring_misconception: string
  speed_assessment: string
  effort_assessment: string
  readiness_change: string
  next_focus: string[]
  interview_likelihood: string
  readiness_snapshot?: ReadinessSnapshot
  session_stats?: Record<string, unknown>
  queue_preview?: { topic: string; score: number }[]
}

export interface ModeLogEntry {
  mode: AgentMode | string
  reason: string
  description?: string
  ts: number
}

export interface TutorResponse {
  type: 'question' | 'hint' | 'explanation' | 'feedback' | 'celebration' | 'topic_transition' | 'prereq_intervention' | 'session_summary'
  content: string
  code_snippet?: string | null
  expected_answer_type: 'code' | 'text' | 'multiple_choice' | 'complexity'
  options?: string[] | null
  difficulty_level: number
  pattern_name?: string | null
  prereq_gap?: { detected: boolean; weak_topic: string | null; explanation: string | null }
  session_summary?: { strengths: string[]; gaps: string[]; next_recommended: string | null } | null
  evaluation?: EvaluationResult | null
  internal_note?: string
  next_action: 'wait_for_answer' | 'end_session' | 'transition_topic'
  _agent_action?: string
  _agent_mode?: AgentMode | string
  _agent_mode_reason?: string
  _active_topic?: string
}

export interface SessionMessage {
  role: 'tutor' | 'user'
  content: string
  type?: TutorResponse['type']
  timestamp: number
}

export interface SessionState {
  topicId: string
  questionsAsked: number
  correctAnswers: number
  hintsUsed: number
  startTime: number
  messages: SessionMessage[]
  currentResponse: TutorResponse | null
  streaming: boolean
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_TOPIC_STAT: TopicStat = {
  knowledge: 0,
  mastery: 0,
  speed: 0,
  confidence: 0,
  consistency: 0,
  patternRecognition: 0,
  attempts: 0,
  correct: 0,
  avgTimeMs: 60000,
  lastSeen: null,
  lastSeenQuestionIndex: 0,
  questionsSinceSeen: 0,
  hesitationCount: 0,
  hintRequests: 0,
  overconfidenceFlags: 0,
  surfaceKnowledgeFlags: 0,
  skipCount: 0,
  hintAvoidanceCount: 0,
  misconceptionHistogram: {},
}

export const DEFAULT_READINESS: ReadinessSnapshot = {
  total: 0,
  coverage: 0,
  accuracy: 0,
  speed: 0,
  consistency: 0,
  recency: 0,
  timestamp: null,
}

export const ASSESSMENT_LEVELS = [
  { lo: 0.0,  hi: 0.20, level: 0, label: 'Unfamiliar' },
  { lo: 0.20, hi: 0.40, level: 1, label: 'Aware' },
  { lo: 0.40, hi: 0.65, level: 2, label: 'Familiar' },
  { lo: 0.65, hi: 0.85, level: 3, label: 'Proficient' },
  { lo: 0.85, hi: 1.01, level: 4, label: 'Expert' },
]

export function assessmentLevel(knowledge: number): { level: number; label: string } {
  for (const band of ASSESSMENT_LEVELS) {
    if (knowledge >= band.lo && knowledge < band.hi) return { level: band.level, label: band.label }
  }
  return { level: 4, label: 'Expert' }
}

export function buildDefaultKnowledgeModel(uid: string, level?: string): KnowledgeModel {
  const priors: Record<string, number> = {}

  if (level === 'intermediate' || level === 'grinding') {
    priors['arrays'] = 0.5
    priors['strings'] = 0.5
    priors['sorting'] = 0.5
    priors['hashing'] = 0.4
    priors['recursion'] = 0.4
  } else if (level === 'basics') {
    priors['arrays'] = 0.3
    priors['strings'] = 0.3
    priors['sorting'] = 0.2
  }

  const topics: Record<string, TopicStat> = {}
  const topicKeys = [
    'arrays','strings','sorting','recursion','hashing','two_pointers','sliding_window',
    'prefix_sum','binary_search','linked_list','stack','queue','doubly_linked_list',
    'merge_sort','quick_sort','backtracking','fast_slow_pointers','monotonic_stack','deque',
    'binary_tree','bst','tree_traversal','heap','bit_manipulation','intervals','greedy',
    'graph_basics','bfs','dfs','lowest_common_ancestor','trie','topological_sort','union_find',
    'shortest_path_dijkstra','shortest_path_bellman','minimum_spanning_tree',
    'dp_intro','dp_1d','divide_conquer','string_matching','dp_2d','dp_knapsack',
    'dp_lcs','dp_trees','segment_tree','fenwick_tree','dp_graphs',
  ]

  for (const key of topicKeys) {
    const k = priors[key] ?? 0
    topics[key] = {
      ...DEFAULT_TOPIC_STAT,
      knowledge: k,
      mastery: k,
      confidence: k ? k * 0.7 : 0,
    }
  }

  return {
    uid,
    topics,
    patternStats: {},
    learningStyle: 'visual',
    pacePreference: 'adaptive',
    currentFocus: 'arrays',
    weaknessVector: [],
    strengthVector: [],
    sessionCount: 0,
    totalMinutes: 0,
    questionCounter: 0,
    readiness: { ...DEFAULT_READINESS },
    readinessHistory: [],
  }
}
