import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider, firebaseEnabled } from '../utils/firebase.js';
import { hydrateFromFirestore, setCurrentTeacher, clearCurrentTeacher, getTeachers } from '../utils/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(firebaseEnabled);

  useEffect(() => {
    if (!firebaseEnabled) return;

    // Handle the result of a redirect sign-in on page load
    getRedirectResult(auth).catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async firebaseUser => {
      if (firebaseUser) {
        setCurrentTeacher(firebaseUser.email);
        await hydrateFromFirestore(firebaseUser.uid, firebaseUser.email);
      } else {
        clearCurrentTeacher();
      }
      setUser(firebaseUser);
      setLoading(false);
      // After redirect sign-in lands back, navigate away from /login
      if (firebaseUser && window.location.pathname === '/login') {
        const teachers = getTeachers();
        const exists = teachers.find(t => t.email === firebaseUser.email);
        window.location.href = exists ? '/' : '/setup';
      }
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    await signInWithRedirect(auth, googleProvider);
  }

  async function signOut() {
    if (firebaseEnabled) await firebaseSignOut(auth);
    clearCurrentTeacher();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
