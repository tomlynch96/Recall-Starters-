import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, setCurrentTeacher } from '../utils/storage.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  function handleEnter(e) {
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
        <form onSubmit={handleEnter} className="bg-white rounded-2xl shadow-md p-8 space-y-4">
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
      </div>
    </div>
  );
}
