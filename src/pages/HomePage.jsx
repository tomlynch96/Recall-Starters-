import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, updateHoDFlag } from '../utils/storage.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ROTAS } from '../data/staticData.js';

function getRotaName(rotaId) {
  const entry = ROTAS.find(r => r.rota_id === rotaId);
  return entry ? entry.rota_name : rotaId;
}

function getLastSession(classId, sessionLog) {
  const sessions = sessionLog.filter(s => s.class_id === classId);
  if (!sessions.length) return null;
  sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
  return sessions[0].opened_at;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const email = getCurrentTeacher();
  const [teachers, setTeachers] = useState(() => getTeachers());
  const sessionLog = getSessionLog();

  if (!email) {
    navigate('/login');
    return null;
  }

  const classSet = new Map();
  for (const t of teachers) {
    if (t.class_id && !classSet.has(t.class_id)) {
      classSet.set(t.class_id, t);
    }
  }
  const classes = Array.from(classSet.values()).filter(t =>
    teachers.some(t2 => t2.email === email && t2.class_id === t.class_id)
  );

  const isHoD = teachers.some(t => t.email === email && t.is_hod);
  const existingHoD = teachers.find(t => t.is_hod && t.email);

  async function logout() {
    await signOut();
    navigate('/login');
  }

  function toggleHoD() {
    updateHoDFlag(email, !isHoD);
    setTeachers(getTeachers());
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-800">Recall Starter</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">{email}</span>

          {/* Only show HoD toggle to: the current HoD, or anyone if no HoD exists yet */}
          {(isHoD || !existingHoD) ? (
            <button
              onClick={toggleHoD}
              title={isHoD ? 'Click to leave HoD mode' : 'Click to enable HoD mode'}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                isHoD
                  ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                  : 'text-gray-400 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {isHoD ? 'HoD ✓' : 'HoD'}
            </button>
          ) : (
            <span className="text-xs text-gray-400 px-3 py-1 rounded-full border border-gray-100">
              HoD: {existingHoD.email.split('@')[0]}
            </span>
          )}

          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Your classes</h2>
          <button
            onClick={() => navigate('/setup')}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
          >
            + Add class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">No classes set up yet.</p>
            <p className="text-gray-400 text-sm">Use the button above to join a class.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(t => {
              const lastSession = getLastSession(t.class_id, sessionLog);
              return (
                <button
                  key={t.class_id}
                  onClick={() => navigate(`/lesson/${encodeURIComponent(t.class_id)}`)}
                  className="bg-white border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
                >
                  <div className="text-2xl font-bold text-blue-800 mb-1">{t.class_id}</div>
                  <div className="text-sm text-gray-500 mb-3">{getRotaName(t.rota_id)}</div>
                  <div className="text-xs text-gray-400">
                    {lastSession
                      ? `Last session: ${new Date(lastSession).toLocaleDateString()}`
                      : 'No sessions yet'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {isHoD && (
        <div className="max-w-4xl mx-auto px-6 pb-10">
          <button
            onClick={() => navigate('/hod')}
            className="w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors font-medium"
          >
            Open HoD Dashboard — all classes overview →
          </button>
        </div>
      )}
    </div>
  );
}
