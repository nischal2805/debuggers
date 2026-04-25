import { signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider, firebaseInitialized } from '../firebase'
import { useStore } from '../store/useStore'

export function useAuth() {
  const { user, enterDemoMode } = useStore()

  const signIn = async () => {
    // If Firebase not available, fall back to demo mode
    if (!firebaseInitialized || !auth || !db || !googleProvider) {
      const token = `demo_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('neuraldsa_demo_token', token)
      enterDemoMode(token)
      return { onboarded: true }
    }

    try {
      const result = await signInWithPopup(auth, googleProvider)
      const firebaseUser = result.user

      const userRef = doc(db, 'users', firebaseUser.uid)
      const snap = await getDoc(userRef)

      if (!snap.exists()) {
        await setDoc(userRef, {
          email: firebaseUser.email,
          name: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          createdAt: serverTimestamp(),
          onboarded: false,
        })
      }

      return snap.exists() ? snap.data() : null
    } catch (error) {
      console.warn('Firebase sign-in failed, falling back to demo mode', error)
      const token = `demo_${Math.random().toString(36).slice(2, 10)}`
      sessionStorage.setItem('neuraldsa_demo_token', token)
      enterDemoMode(token)
      return { onboarded: true }
    }
  }

  const logOut = async () => {
    if (firebaseInitialized && auth) {
      await signOut(auth)
    }
  }

  return { user, signIn, logOut }
}
