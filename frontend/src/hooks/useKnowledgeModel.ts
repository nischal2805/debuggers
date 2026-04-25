import { useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useStore } from '../store/useStore'
import type { KnowledgeModel } from '../lib/types'
import { buildDefaultKnowledgeModel } from '../lib/types'

export function useKnowledgeModel() {
  const { user, isDemoMode, knowledgeModel, setKnowledgeModel } = useStore()

  useEffect(() => {
    // Demo mode: knowledge model lives in Zustand only, updated via mastery_update WS events
    if (!user || isDemoMode) return

    const ref = doc(db, 'users', user.uid, 'knowledgeModel', 'current')
    const unsubscribe = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        setKnowledgeModel(snap.data() as KnowledgeModel)
      } else {
        const initial = buildDefaultKnowledgeModel(user.uid)
        await setDoc(ref, initial)
        setKnowledgeModel(initial)
      }
    })

    return unsubscribe
  }, [user, isDemoMode, setKnowledgeModel])

  return knowledgeModel
}
