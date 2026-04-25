import { create } from 'zustand'
import type { KnowledgeModel, UserProfile, SessionState } from '../lib/types'

interface AppStore {
  user: UserProfile | null
  loading: boolean
  knowledgeModel: KnowledgeModel | null
  session: SessionState | null

  setUser: (user: UserProfile | null) => void
  setLoading: (v: boolean) => void
  setKnowledgeModel: (model: KnowledgeModel) => void
  updateTopicMastery: (topicId: string, mastery: number, confidence: number) => void
  setSession: (session: SessionState | null) => void
  updateSession: (partial: Partial<SessionState>) => void
}

export const useStore = create<AppStore>((set) => ({
  user: null,
  loading: true,
  knowledgeModel: null,
  session: null,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setKnowledgeModel: (knowledgeModel) => set({ knowledgeModel }),

  updateTopicMastery: (topicId, mastery, confidence) =>
    set((state) => {
      if (!state.knowledgeModel) return {}
      return {
        knowledgeModel: {
          ...state.knowledgeModel,
          topics: {
            ...state.knowledgeModel.topics,
            [topicId]: {
              ...state.knowledgeModel.topics[topicId],
              mastery,
              confidence,
            },
          },
        },
      }
    }),

  setSession: (session) => set({ session }),
  updateSession: (partial) =>
    set((state) => ({
      session: state.session ? { ...state.session, ...partial } : null,
    })),
}))
