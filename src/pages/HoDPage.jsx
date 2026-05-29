import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, getClassOptions, addClassOption, removeClassOption } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';
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

  const [classOptions, setClassOptions] = useState(() => getClassOptions());
  const [newClassName, setNewClassName] = useState('');

  const isHoD = teachers.some(t => t.email === email && t.is_hod);
  if (!isHoD) {
    navigate('/');
    return null;
  }

  function handleAddClass(e) {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    if (classOptions.find(o => o.class_id === name)) return;
    const classObj = { id: generateUUID(), class_id: name };
    addClassOption(classObj);
    setClassOptions(getClassOptions());
    setNewClassName('');
  }

  function handleRemoveClass(id) {
    removeClassOption(id);
    setClassOptions(getClassOptions());
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

        {/* ── Class management ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Class setup</h2>
          <p className="text-sm text-gray-400 mb-4">
            Add the classes teachers can choose from. Teachers cannot create their own until at least one is listed here.
          </p>

          <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              placeholder="Class name e.g. 10A/Sc1"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
            >
              Add class
            </button>
          </form>

          {classOptions.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              No classes added yet — teachers will see a locked screen until you add at least one.
            </p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {classOptions.map(option => (
                <div key={option.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-semibold text-gray-800 mr-3">{option.class_id}</span>
                    <span className="text-sm text-gray-400">{option.rota_label}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveClass(option.id)}
                    className="text-sm text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Teacher assignments ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Teacher assignments</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {classOptions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No classes created yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Class', 'Teachers', 'Rotas'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classOptions.map(opt => {
                    const assigned = teachers.filter(t => t.class_id === opt.class_id && t.email);
                    return (
                      <tr key={opt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{opt.class_id}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {assigned.length === 0
                            ? <span className="text-gray-300 italic">None yet</span>
                            : assigned.map(t => <div key={t.id}>{t.email}</div>)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {assigned.length === 0
                            ? '—'
                            : assigned.map(t => <div key={t.id}>{getRotaName(t.rota_id)}</div>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Class engagement overview ── */}
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
