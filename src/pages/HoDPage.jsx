import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, getClassOptions, addClassOption, removeClassOption, getCustomQuestions, saveCustomQuestions, clearCustomQuestions, getActiveQuestions, getCustomChallengePlus, saveCustomChallengePlus, clearCustomChallengePlus, getActiveChallengePlus } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';
import { ROTAS, QUESTIONS, LESSONS } from '../data/staticData.js';
import * as XLSX from 'xlsx';

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
  const [usingCustom, setUsingCustom] = useState(() => !!(getCustomQuestions() || getCustomChallengePlus()));
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef(null);

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Questions
    const questions = getActiveQuestions();
    const qRows = questions.map(q => ({
      id: q.id,
      lesson_id: q.lesson_id,
      Lesson: q.lesson_title,
      Question: q.question,
      Answer: q.answer,
      Scaffold: q.scaffolded || '',
    }));
    const wsQ = XLSX.utils.json_to_sheet(qRows, {
      header: ['id', 'lesson_id', 'Lesson', 'Question', 'Answer', 'Scaffold'],
    });
    wsQ['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 28 }, { wch: 60 }, { wch: 60 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsQ, 'Questions');

    // Sheet 2: Challenge+ — one row per lesson, pre-filled where a challenge question exists
    const activeChallenge = getActiveChallengePlus();
    const challengeMap = new Map(activeChallenge.map(c => [c.lesson_id, c]));
    const cRows = LESSONS.map(l => {
      const existing = challengeMap.get(l.lesson_id);
      return {
        lesson_id: l.lesson_id,
        Lesson: l.lesson_title,
        'Challenge Question': existing?.question || '',
        'Challenge Answer': existing?.answer || '',
      };
    });
    const wsC = XLSX.utils.json_to_sheet(cRows, {
      header: ['lesson_id', 'Lesson', 'Challenge Question', 'Challenge Answer'],
    });
    wsC['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 80 }, { wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsC, 'Challenge+');

    XLSX.writeFile(wb, 'recall-starter-questions.xlsx');
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Uploading…');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);

      // Sheet 1: Questions
      const wsQ = wb.Sheets['Questions'] || wb.Sheets[wb.SheetNames[0]];
      const qRows = XLSX.utils.sheet_to_json(wsQ, { defval: '' });
      const rowMap = new Map(qRows.map(r => [String(r.id), r]));
      const updatedQuestions = QUESTIONS.map(q => {
        const row = rowMap.get(String(q.id));
        if (!row) return q;
        return {
          ...q,
          question: String(row.Question ?? q.question).trim() || q.question,
          answer: String(row.Answer ?? q.answer).trim() || q.answer,
          scaffolded: String(row.Scaffold ?? q.scaffolded ?? '').trim() || q.scaffolded,
        };
      });
      saveCustomQuestions(updatedQuestions);

      // Sheet 2: Challenge+ — find by name (flexible) or fall back to second sheet
      const challengeSheetName = wb.SheetNames.find(n =>
        n.toLowerCase().includes('challenge')
      ) || wb.SheetNames[1];
      const wsC = challengeSheetName ? wb.Sheets[challengeSheetName] : null;
      let challengeCount = 0;
      if (wsC) {
        const cRows = XLSX.utils.sheet_to_json(wsC, { defval: '' });
        const updatedChallenge = cRows
          .filter(r => String(r['Challenge Question'] || '').trim())
          .map(r => ({
            lesson_id: String(r.lesson_id ?? r.lesson_id ?? '').trim(),
            question: String(r['Challenge Question']).trim(),
            answer: String(r['Challenge Answer'] || '').trim(),
          }))
          .filter(r => r.lesson_id);
        challengeCount = updatedChallenge.length;
        saveCustomChallengePlus(updatedChallenge);
      }

      setUsingCustom(true);
      setUploadStatus(`✓ ${updatedQuestions.length} questions · ${challengeCount} challenge+ question${challengeCount !== 1 ? 's' : ''} saved`);
    } catch {
      setUploadStatus('Upload failed — check the file format');
    }
    e.target.value = '';
  }

  function handleRevert() {
    clearCustomQuestions();
    clearCustomChallengePlus();
    setUsingCustom(false);
    setUploadStatus('Reverted to default questions');
  }

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
    if (t.class_id && !classMap.has(t.class_id)) classMap.set(t.class_id, t);
  }

  const classRows = Array.from(classMap.values()).map(t => {
    const sessions = sessionLog.filter(s => s.class_id === t.class_id);
    sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
    const lastSession = sessions[0]?.opened_at || null;
    const termSessions = sessions.filter(s => new Date(s.opened_at) >= thisTermStart).length;
    const recentSessions = sessions.filter(s => new Date(s.opened_at) >= twoWeeksAgo).length;
    return { ...t, lastSession, termSessions, recentSessions };
  });

  const teacherRows = teachers.filter(t => t.class_id).map(t => {
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
        {/* ── Question bank ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Question bank</h2>
          <p className="text-sm text-gray-400 mb-4">
            Download the template, edit questions / answers / scaffolds in Excel or Google Sheets, then re-upload. Topics and rotas are read-only — do not edit the <code>id</code> or <code>lesson_id</code> columns.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${usingCustom ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {usingCustom ? 'Custom questions active' : `Default questions (${QUESTIONS.length})`}
              </span>
              {uploadStatus && (
                <span className="text-sm text-gray-500">{uploadStatus}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={downloadTemplate}
                className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
              >
                ↓ Download template
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 bg-white border-2 border-blue-300 text-blue-700 text-sm font-semibold rounded-xl hover:border-blue-500 transition-colors"
              >
                ↑ Upload edited file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                onChange={handleUpload}
                className="hidden"
              />

              {usingCustom && (
                <button
                  onClick={handleRevert}
                  className="px-5 py-2 bg-white border-2 border-gray-200 text-gray-500 text-sm font-semibold rounded-xl hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  Revert to defaults
                </button>
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
