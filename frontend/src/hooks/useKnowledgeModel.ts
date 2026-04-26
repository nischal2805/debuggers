import { useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useStore } from '../store/useStore'
import type { KnowledgeModel } from '../lib/types'
import { buildDefaultKnowledgeModel } from '../lib/types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export function useKnowledgeModel() {
  const { user, isDemoMode, demoToken, knowledgeModel, setKnowledgeModel } = useStore()
  const fetchedDemo = useRef(false)

  useEffect(() => {
    if (!user) return

    if (isDemoMode) {
      // Demo mode: fetch knowledge model from backend once per session
      if (fetchedDemo.current || !demoToken) return
      fetchedDemo.current = true
      fetch(`${BACKEND_URL}/user/model`, {
        headers: { Authorization: `Bearer ${demoToken}` },
      })
        .then(r => r.json())
        .then(data => setKnowledgeModel(data as KnowledgeModel))
        .catch(() => setKnowledgeModel(buildDefaultKnowledgeModel(user.uid)))
      return
    }

    if (!db) return

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
  }, [user, isDemoMode, demoToken, setKnowledgeModel])

  return knowledgeModel
}
