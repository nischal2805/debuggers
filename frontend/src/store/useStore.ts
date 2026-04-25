import { create } from 'zustand'
import type {
  KnowledgeModel,
  UserProfile,
  SessionState,
  ReadinessSnapshot,
  PriorityQueueEntry,
  ModeLogEntry,
  ReportCard,
  AgentMode,
} from '../lib/types'
import { DEFAULT_READINESS } from '../lib/types'

const MAX_LOG = 80

interface StreakEntry {
  topic: string
  correct: boolean
  ts: number
}

interface AppStore {
  user: UserProfile | null
  loading: boolean
  isDemoMode: boolean
  demoToken: string | null
  knowledgeModel: KnowledgeModel | null
  session: SessionState | null

  // Agent intelligence layer (live during session, sticky between)
  readiness: ReadinessSnapshot
  calibrationGap: number
  priorityQueue: PriorityQueueEntry[]
  priorityExplanation: string
  agentLog: ModeLogEntry[]
  currentMode: AgentMode | string | null
  currentModeReason: string | null
  answerStreak: StreakEntry[]
  reviewDue: string[]
  lastReport: ReportCard | null
  masteredJustNow: string[]

  setUser: (user: UserProfile | null) => void
  setLoading: (v: boolean) => void
  enterDemoMode: (token: string) => void
  exitDemoMode: () => void
  setKnowledgeModel: (model: KnowledgeModel) => void
  updateTopicMastery: (topicId: string, partial: Partial<{
    knowledge: number; mastery: number; confidence: number; speed: number;
    consistency: number; patternRecognition: number;
  }>) => void
  setSession: (session: SessionState | null) => void
  updateSession: (partial: Partial<SessionState>) => void

  // Agent layer setters
  setReadiness: (snap: ReadinessSnapshot, gap?: number) => void
  setPriorityQueue: (q: PriorityQueueEntry[], explanation?: string) => void
  pushAgentLog: (entry: ModeLogEntry) => void
  setCurrentMode: (mode: AgentMode | string | null, reason: string | null) => void
  pushAnswer: (entry: StreakEntry) => void
  setReviewDue: (topics: string[]) => void
  setLastReport: (report: ReportCard | null) => void
  acknowledgeMastered: (topic: string) => void
  resetSessionLayer: () => void
}

export const useStore = create<AppStore>((set, get) => ({
  user: null,
  loading: true,
  isDemoMode: false,
  demoToken: null,
  knowledgeModel: null,
  session: null,

  readiness: { ...DEFAULT_READINESS },
  calibrationGap: 0,
  priorityQueue: [],
  priorityExplanation: '',
  agentLog: [],
  currentMode: null,
  currentModeReason: null,
  answerStreak: [],
  reviewDue: [],
  lastReport: null,
  masteredJustNow: [],

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  enterDemoMode: (token) => set({
    isDemoMode: true,
    demoToken: token,
    loading: false,
    user: {
      uid: token,
      email: 'demo@neuraldsa.local',
      name: 'Demo User',
      photoURL: '',
      onboarded: true,
    },
  }),

  exitDemoMode: () => set({
    isDemoMode: false,
    demoToken: null,
    user: null,
    knowledgeModel: null,
    readiness: { ...DEFAULT_READINESS },
    calibrationGap: 0,
    priorityQueue: [],
    priorityExplanation: '',
    agentLog: [],
    currentMode: null,
    currentModeReason: null,
    answerStreak: [],
    reviewDue: [],
    lastReport: null,
    masteredJustNow: [],
  }),

  setKnowledgeModel: (knowledgeModel) => set({
    knowledgeModel,
    readiness: knowledgeModel.readiness ?? { ...DEFAULT_READINESS },
  }),

  updateTopicMastery: (topicId, partial) =>
    set((state) => {
      if (!state.knowledgeModel) return {}
      const prev = state.knowledgeModel.topics[topicId] ?? {
        knowledge: 0, mastery: 0, confidence: 0, speed: 0, consistency: 0, patternRecognition: 0,
        attempts: 0, correct: 0, avgTimeMs: 60000, lastSeen: null,
        hesitationCount: 0, hintRequests: 0,
      }
      const next = { ...prev, ...partial }
      // Keep mastery + knowledge synced
      if (partial.knowledge !== undefined && partial.mastery === undefined) {
        next.mastery = partial.knowledge
      }
      if (partial.mastery !== undefined && partial.knowledge === undefined) {
        next.knowledge = partial.mastery
      }
      const wasMastered = (prev.knowledge ?? prev.mastery ?? 0) >= 0.85
      const isMastered = (next.knowledge ?? next.mastery ?? 0) >= 0.85

      return {
        knowledgeModel: {
          ...state.knowledgeModel,
          topics: {
            ...state.knowledgeModel.topics,
            [topicId]: next,
          },
        },
        masteredJustNow: !wasMastered && isMastered
          ? [...state.masteredJustNow, topicId]
          : state.masteredJustNow,
      }
    }),

  setSession: (session) => set({ session }),
  updateSession: (partial) =>
    set((state) => ({
      session: state.session ? { ...state.session, ...partial } : null,
    })),

  setReadiness: (snapshot, gap) => set({
    readiness: snapshot,
    calibrationGap: gap ?? get().calibrationGap,
  }),

  setPriorityQueue: (queue, explanation) => set({
    priorityQueue: queue,
    priorityExplanation: explanation ?? '',
  }),

  pushAgentLog: (entry) => set((state) => ({
    agentLog: [...state.agentLog, entry].slice(-MAX_LOG),
  })),

  setCurrentMode: (mode, reason) => set({ currentMode: mode, currentModeReason: reason }),

  pushAnswer: (entry) => set((state) => ({
    answerStreak: [...state.answerStreak, entry].slice(-10),
  })),

  setReviewDue: (topics) => set({ reviewDue: topics }),

  setLastReport: (report) => set({ lastReport: report }),

  acknowledgeMastered: (topic) => set((state) => ({
    masteredJustNow: state.masteredJustNow.filter(t => t !== topic),
  })),

  resetSessionLayer: () => set({
    agentLog: [],
    currentMode: null,
    currentModeReason: null,
    answerStreak: [],
    masteredJustNow: [],
    lastReport: null,
  }),
}))
