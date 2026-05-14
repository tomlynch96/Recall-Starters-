import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, clearCurrentTeacher, getSessionLog } from '../utils/storage.js';
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
  const email = getCurrentTeacher();
  const teachers = getTeachers();
  const sessionLog = getSessionLog();
  const currentTeacher = teachers.find(t => t.email === email);

  if (!email) {
    navigate('/login');
    return null;
  }

  const classSet = new Map();
  for (const t of teachers) {
    if (!classSet.has(t.class_id)) {
      classSet.set(t.class_id, t);
    }
  }
  const classes = Array.from(classSet.values());

  function logout() {
    clearCurrentTeacher();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-800">Recall Starter</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">{email}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-xl font-semibold text-gray-700 mb-6">Your classes</h2>
        {classes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No classes set up yet.</p>
            <button
              onClick={() => navigate('/setup')}
              className="mt-4 px-6 py-2 bg-blue-700 text-white rounded-xl hover:bg-blue-800"
            >
              Add a class
            </button>
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

      <footer className="text-center py-6">
        {currentTeacher?.is_hod && (
          <button
            onClick={() => navigate('/hod')}
            className="text-sm text-blue-600 hover:underline"
          >
            HoD Dashboard
          </button>
        )}
      </footer>
    </div>
  );
}
