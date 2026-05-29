import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, setCurrentTeacher } from '../utils/storage.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { firebaseEnabled } from '../utils/firebase.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  async function handleGoogleSignIn() {
    setError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // onAuthStateChanged handles setCurrentTeacher, hydration, and navigation
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Sign-in failed. Please try again.');
      setSigningIn(false);
    }
  }

  // Fallback email form (used when Firebase is not configured)
  function handleEmailEnter(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setCurrentTeacher(trimmed);
    const teachers = getTeachers();
    const exists = teachers.find(t => t.email === trimmed);
    navigate(exists ? '/' : '/setup');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-blue-800 mb-2 text-center">Recall Starter</h1>
        <p className="text-gray-500 text-center mb-10">Science Department</p>

        {firebaseEnabled ? (
          <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center gap-4">
            <p className="text-gray-600 text-center mb-2">
              Sign in with your school Google account
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-semibold hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {signingIn ? 'Signing in…' : 'Sign in with Google'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailEnter} className="bg-white rounded-2xl shadow-md p-8 space-y-4">
            <label className="block text-gray-700 font-medium mb-1">Your school email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@school.ac.uk"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full bg-blue-700 text-white text-lg font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors"
            >
              Enter
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
