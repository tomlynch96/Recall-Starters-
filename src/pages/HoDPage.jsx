import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog } from '../utils/storage.js';
import { ROTAS } from '../data/staticData.js';

function getRotaName(rotaId) {
  const e = ROTAS.find(r => r.rota_id === rotaId);
  return e ? e.rota_name : rotaId;
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

function statusIcon(lastSessionDate) {
  const d = daysSince(lastSessionDate);
  if (d <= 14) return '🟢';
  if (d <= 28) return '🟡';
  return '🔴';
}

export default function HoDPage() {
  const navigate = useNavigate();
  const email = getCurrentTeacher();
  const teachers = getTeachers();
  const current = teachers.find(t => t.email === email);

  if (!current?.is_hod) {
    navigate('/');
    return null;
  }

  const sessionLog = getSessionLog();
  const now = new Date();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const thisTermStart = new Date(now.getFullYear(), now.getMonth() < 8 ? 0 : 8, 1);

  const classMap = new Map();
  for (const t of teachers) {
    if (!classMap.has(t.class_id)) classMap.set(t.class_id, t);
  }

  const classRows = Array.from(classMap.values()).map(t => {
    const sessions = sessionLog.filter(s => s.class_id === t.class_id);
    sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
    const lastSession = sessions[0]?.opened_at || null;
    const termSessions = sessions.filter(s => new Date(s.opened_at) >= thisTermStart).length;
    const recentSessions = sessions.filter(s => new Date(s.opened_at) >= twoWeeksAgo).length;
    return { ...t, lastSession, termSessions, recentSessions };
  });

  const teacherRows = teachers.map(t => {
    const sessions = sessionLog.filter(s => s.teacher_email === t.email && s.class_id === t.class_id);
    sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
    return { ...t, totalSessions: sessions.length, lastSession: sessions[0]?.opened_at || null };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">← Back</button>
        <h1 className="text-xl font-bold text-blue-800">HoD Dashboard</h1>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Class overview</h2>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Class', 'Rota', 'Last session', 'This term', 'Last 2 weeks', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classRows.map(row => (
                  <tr key={row.class_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.class_id}</td>
                    <td className="px-4 py-3 text-gray-500">{getRotaName(row.rota_id)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.lastSession ? new Date(row.lastSession).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.termSessions}</td>
                    <td className="px-4 py-3 text-gray-700">{row.recentSessions}</td>
                    <td className="px-4 py-3 text-xl">{statusIcon(row.lastSession)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Teacher breakdown</h2>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Teacher', 'Class', 'Total sessions', 'Last session'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teacherRows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.email}</td>
                    <td className="px-4 py-3 text-gray-500">{row.class_id}</td>
                    <td className="px-4 py-3 text-gray-700">{row.totalSessions}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.lastSession ? new Date(row.lastSession).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
