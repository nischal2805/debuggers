import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { useStore } from './store/useStore'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import Solve from './pages/Solve'
import Profile from './pages/Profile'
import JudgeDashboard from './pages/JudgeDashboard'
import Interview from './pages/Interview'
import TMinusProtocol from './pages/TMinusProtocol'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  const { setUser, setLoading, enterDemoMode } = useStore()

  useEffect(() => {
    // Restore demo mode across page refreshes
    const savedDemo = sessionStorage.getItem('neuraldsa_demo_token')
    if (savedDemo) {
      enterDemoMode(savedDemo)
      return
    }

    // If Firebase not initialized, use demo mode
    if (!auth) {
      const token = `demo_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('neuraldsa_demo_token', token)
      enterDemoMode(token)
      return
    }

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
  }, [setUser, setLoading, enterDemoMode])

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
        <Route path="/solve/:topicId" element={
          <ProtectedRoute requireOnboarded>
            <Solve />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requireOnboarded>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/judge" element={
          <ProtectedRoute requireOnboarded>
            <JudgeDashboard />
          </ProtectedRoute>
        } />
        <Route path="/interview/:topicId" element={
          <ProtectedRoute requireOnboarded>
            <Interview />
          </ProtectedRoute>
        } />
        <Route path="/tminus" element={
          <ProtectedRoute requireOnboarded>
            <TMinusProtocol />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
