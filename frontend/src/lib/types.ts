export interface TopicStat {
  mastery: number
  confidence: number
  attempts: number
  correct: number
  avgTimeMs: number
  lastSeen: string | null
  hesitationCount: number
  hintRequests: number
}

export interface KnowledgeModel {
  uid: string
  topics: Record<string, TopicStat>
  learningStyle: 'visual' | 'analytical' | 'trial-error'
  pacePreference: 'fast' | 'slow' | 'adaptive'
  currentFocus: string
  weaknessVector: string[]
  strengthVector: string[]
  sessionCount: number
  totalMinutes: number
}

export interface UserProfile {
  uid: string
  email: string
  name: string
  photoURL: string
  goal?: 'placement' | 'faang' | 'competitive' | 'learning'
  dailyGoalMinutes?: number
  onboarded?: boolean
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
  internal_note?: string
  next_action: 'wait_for_answer' | 'end_session' | 'transition_topic'
  _agent_action?: string
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

export const DEFAULT_TOPIC_STAT: TopicStat = {
  mastery: 0,
  confidence: 0,
  attempts: 0,
  correct: 0,
  avgTimeMs: 60000,
  lastSeen: null,
  hesitationCount: 0,
  hintRequests: 0,
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
    'dp_lcs','dp_trees','segment_tree','fenwick_tree','dp_graphs'
  ]

  for (const key of topicKeys) {
    topics[key] = { ...DEFAULT_TOPIC_STAT, mastery: priors[key] ?? 0, confidence: priors[key] ? priors[key] * 0.7 : 0 }
  }

  return {
    uid,
    topics,
    learningStyle: 'visual',
    pacePreference: 'adaptive',
    currentFocus: 'arrays',
    weaknessVector: [],
    strengthVector: [],
    sessionCount: 0,
    totalMinutes: 0,
  }
}
