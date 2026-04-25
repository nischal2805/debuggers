import { useEffect } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useStore } from '../store/useStore'
import type { KnowledgeModel } from '../lib/types'
import { buildDefaultKnowledgeModel } from '../lib/types'

export function useKnowledgeModel() {
  const { user, knowledgeModel, setKnowledgeModel } = useStore()

  useEffect(() => {
    if (!user) return

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
  }, [user, setKnowledgeModel])

  return knowledgeModel
}
