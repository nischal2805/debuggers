import { signInWithPopup, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { useStore } from '../store/useStore'

export function useAuth() {
  const { user } = useStore()

  const signIn = async () => {
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
  }

  const logOut = async () => {
    await signOut(auth)
  }

  return { user, signIn, logOut }
}
