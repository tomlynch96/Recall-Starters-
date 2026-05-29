import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase.js';
import {
  setCurrentTeacher, clearCurrentTeacher,
  saveTeachers, saveQuestionLog, saveSessionLog, saveClassOptions,
} from '../utils/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = still checking; null = confirmed logged out
  const [session, setSession] = useState(undefined);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session ?? null);
      if (session) {
        hydrateFromSupabase(session);
      } else {
        setHydrated(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session ?? null);
      if (event === 'SIGNED_IN' && session) {
        hydrateFromSupabase(session);
      }
      if (event === 'SIGNED_OUT') {
        clearCurrentTeacher();
        localStorage.removeItem('rs_user_id');
        setHydrated(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function hydrateFromSupabase(session) {
    const email = session.user.email.toLowerCase();
    const userId = session.user.id;

    setCurrentTeacher(email);
    localStorage.setItem('rs_user_id', userId);

    try {
      const [teachersRes, classesRes, qLogRes, sLogRes] = await Promise.all([
        supabase.from('teachers').select('*'),
        supabase.from('classes').select('*'),
        supabase.from('question_log').select('*'),
        supabase.from('session_log').select('*'),
      ]);

      if (teachersRes.data) saveTeachers(teachersRes.data);
      if (classesRes.data) saveClassOptions(classesRes.data);
      if (qLogRes.data) saveQuestionLog(qLogRes.data);
      if (sLogRes.data) saveSessionLog(sLogRes.data);
    } catch (err) {
      console.warn('Supabase hydration failed, using localStorage cache:', err.message);
    }

    setHydrated(true);
  }

  async function signOut() {
    clearCurrentTeacher();
    localStorage.removeItem('rs_user_id');
    await supabase.auth.signOut();
    setSession(null);
    setHydrated(false);
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading: session === undefined,
      hydrated,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
