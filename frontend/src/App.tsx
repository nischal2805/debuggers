import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useStore } from './store/useStore'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import Roadmap from './pages/Roadmap'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const { setUser, setLoading } = useStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          name: firebaseUser.displayName || 'User',
          photoURL: firebaseUser.photoURL || '',
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [setUser, setLoading])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboard" element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requireOnboarded>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/session/:topicId" element={
          <ProtectedRoute requireOnboarded>
            <Session />
          </ProtectedRoute>
        } />
        <Route path="/roadmap" element={
          <ProtectedRoute requireOnboarded>
            <Roadmap />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requireOnboarded>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
