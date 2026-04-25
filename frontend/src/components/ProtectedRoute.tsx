import { ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useStore } from '../store/useStore'

interface Props {
  children: ReactNode
  requireOnboarded?: boolean
}

export default function ProtectedRoute({ children, requireOnboarded }: Props) {
  const { user, loading } = useStore()
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!user || !requireOnboarded) return
    setChecking(true)
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      setOnboarded(snap.exists() ? (snap.data()?.onboarded ?? false) : false)
      setChecking(false)
    })
  }, [user, requireOnboarded])

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/" replace />

  if (requireOnboarded && onboarded === false) {
    return <Navigate to="/onboard" replace />
  }

  return <>{children}</>
}
