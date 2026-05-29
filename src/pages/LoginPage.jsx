import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, hydrated } = useAuth();

  useEffect(() => {
    if (user && hydrated) navigate('/');
  }, [user, hydrated]);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-4xl font-bold text-blue-800 mb-2 text-center">Recall Starter</h1>
        <p className="text-gray-500 text-center mb-10">Science Department</p>
        <div className="bg-white rounded-2xl shadow-md p-8">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 text-gray-700 text-lg font-semibold py-3 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.1c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.2 7.4-10.5 7.4-17.3z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.9-6c-2.1 1.4-4.8 2.3-8 2.3-6.1 0-11.3-4.1-13.1-9.7H2.7v6.2C6.7 42.8 14.8 48 24 48z"/>
              <path fill="#FBBC04" d="M10.9 28.8c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-6.2H2.7C1 17.1 0 20.4 0 24s1 6.9 2.7 9.8l8.2-5z"/>
              <path fill="#E94235" d="M24 9.5c3.4 0 6.5 1.2 8.9 3.5l6.6-6.6C35.9 2.4 30.4 0 24 0 14.8 0 6.7 5.2 2.7 13.2l8.2 6.2C12.7 13.6 17.9 9.5 24 9.5z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
