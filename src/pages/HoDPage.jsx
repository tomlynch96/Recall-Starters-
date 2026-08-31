import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, getClassOptions, addClassOption, removeClassOption, getCustomQuestions, saveCustomQuestions, clearCustomQuestions, getActiveQuestions, getCustomChallengePlus, saveCustomChallengePlus, clearCustomChallengePlus, getActiveChallengePlus, getActiveRotas, saveCustomRotas, getQuestionVersions, pushQuestionVersion, resetClassProgress } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';
import { QUESTIONS, CHALLENGE_PLUS, LESSONS } from '../data/staticData.js';
import { parseQuestionWorkbook, assignIds, buildQuestionWorkbook, diffLessonOrder, reorderRotasByFileOrder } from '../utils/questionFiles.js';
import RotaEditor from '../components/RotaEditor.jsx';
import QuestionPreview from '../components/QuestionPreview.jsx';

function getRotaName(rotaId) {
  const e = getActiveRotas().find(r => r.rota_id === rotaId);
  return e ? e.rota_name : rotaId;
}

const NAV = [
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'questions', label: 'Question files', icon: '📄' },
  { id: 'rotas', label: 'Rotas', icon: '🗓️' },
];

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

  const [section, setSection] = useState('analytics');
  const [, forceRefresh] = useState(0);
  const [classOptions, setClassOptions] = useState(() => getClassOptions());
  const [newClassName, setNewClassName] = useState('');
  const [usingCustom, setUsingCustom] = useState(() => !!(getCustomQuestions() || getCustomChallengePlus()));
  const [uploadStatus, setUploadStatus] = useState('');
  const [versions, setVersions] = useState(() => getQuestionVersions());
  const [pendingOrder, setPendingOrder] = useState(null);
  const fileInputRef = useRef(null);
  const topicFileInputRef = useRef(null);


  // Topic list for static download links (files generated at build time by exportTopicTemplates.py)
  const topicList = Array.from(
    LESSONS.reduce((m, l) => { m.set(l.topic_name, (m.get(l.topic_name) || 0) + 1); return m; }, new Map())
  ).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));

  function topicFilename(topicName) {
    return topicName.replace(/[/\\?*[\]:,&]/g, '-').replace(/\s+/g, ' ').trim() + '-template.xlsx';
  }

  // Save a new bank, record a version snapshot, refresh state
  function recordAndSave(questions, challenge, meta) {
    saveCustomQuestions(questions);
    saveCustomChallengePlus(challenge);
    const version = {
      id: generateUUID(),
      at: new Date().toISOString(),
      by: email,
      kind: meta.kind,                 // 'full' | 'topic' | 'restore'
      topics: meta.topics || [],
      questionCount: questions.length,
      challengeCount: challenge.length,
      questions,                       // snapshot for redownload / restore
      challenge,
    };
    setVersions(pushQuestionVersion(version));
    setUsingCustom(true);
  }

  // After parsing an upload, warn if the lesson order differs from natural
  // (alphabetical) order, then save. "Use Excel order" also reorders rotas.
  function finalizeUpload({ questions, challenge, kind, topics, fileOrderByTopic }) {
    const diffs = diffLessonOrder(fileOrderByTopic);
    const commit = (useExcelOrder) => {
      if (useExcelOrder) {
        saveCustomRotas(reorderRotasByFileOrder(getActiveRotas(), fileOrderByTopic));
      }
      recordAndSave(questions, challenge, { kind, topics });
      setPendingOrder(null);
      setUploadStatus(
        `✓ Saved ${questions.length} questions` +
        (topics.length ? ` · ${topics.length} topic${topics.length !== 1 ? 's' : ''}` : '') +
        (useExcelOrder ? ' · rota order updated' : '')
      );
    };
    if (diffs.length > 0) {
      setPendingOrder({ diffs, onExcel: () => commit(true), onNatural: () => commit(false) });
    } else {
      commit(false);
    }
  }

  function downloadCurrent() {
    buildQuestionWorkbook(getActiveQuestions(), getActiveChallengePlus(), 'recall-starter-questions.xlsx');
  }

  function downloadOriginal() {
    buildQuestionWorkbook(QUESTIONS, CHALLENGE_PLUS, 'recall-starter-questions-ORIGINAL.xlsx');
  }

  // Full-bank upload — the sheet completely replaces the bank
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadStatus('Reading file…');
    try {
      const buf = await file.arrayBuffer();
      const { questions, challenge, topics, fileOrderByTopic } = parseQuestionWorkbook(buf);
      finalizeUpload({ questions: assignIds(questions), challenge, kind: 'full', topics, fileOrderByTopic });
    } catch (err) {
      console.error(err);
      setUploadStatus('Upload failed — check the file format');
    }
    e.target.value = '';
  }

  // Per-topic upload — each file replaces only its own topic(s) in the bank
  async function handleTopicUpload(e) {
    const files = [...e.target.files];
    if (!files.length) return;
    setUploadStatus('Reading files…');
    try {
      let bankQ = [...getActiveQuestions()];
      let bankC = [...getActiveChallengePlus()];
      const topicOfLesson = new Map(LESSONS.map(l => [l.lesson_id, l.topic_name]));
      const allTopics = new Set();
      const combinedOrder = new Map();

      for (const file of files) {
        const buf = await file.arrayBuffer();
        const { questions, challenge, topics, fileOrderByTopic } = parseQuestionWorkbook(buf);
        if (topics.length === 0) continue;
        for (const [t, order] of fileOrderByTopic.entries()) combinedOrder.set(t, order);
        const topicSet = new Set(topics);
        topics.forEach(t => allTopics.add(t));
        // Drop the bank's existing questions/challenge for these topics, add the file's
        bankQ = bankQ.filter(q => !topicSet.has(q.topic_name));
        bankC = bankC.filter(c => !topicSet.has(topicOfLesson.get(c.lesson_id)));
        const newQ = assignIds(questions, bankQ.map(q => q.id));
        bankQ = [...bankQ, ...newQ];
        bankC = [...bankC, ...challenge];
      }

      if (allTopics.size === 0) {
        setUploadStatus('No recognised topics found in those files.');
      } else {
        finalizeUpload({ questions: bankQ, challenge: bankC, kind: 'topic', topics: [...allTopics], fileOrderByTopic: combinedOrder });
      }
    } catch (err) {
      console.error(err);
      setUploadStatus('Upload failed — check the file format');
    }
    e.target.value = '';
  }

  function downloadVersion(v) {
    buildQuestionWorkbook(v.questions || [], v.challenge || [], `recall-questions-${new Date(v.at).toISOString().slice(0, 10)}.xlsx`);
  }

  function restoreVersion(v) {
    if (!v.questions) return;
    if (!window.confirm(`Restore the question bank to the version from ${new Date(v.at).toLocaleString()}? This replaces the current bank for everyone.`)) return;
    recordAndSave(v.questions, v.challenge || [], { kind: 'restore', topics: v.topics || [] });
    setUploadStatus('✓ Restored earlier version');
  }

  function handleRevert() {
    if (!window.confirm('Revert to the default question bank? All uploaded questions and challenge+ edits will be discarded for every teacher.')) return;
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
    const opt = classOptions.find(o => o.id === id);
    if (!window.confirm(`Remove class "${opt?.class_id || ''}"? Teachers will no longer be able to select it.`)) return;
    removeClassOption(id);
    setClassOptions(getClassOptions());
  }

  function handleResetProgress(classId, email) {
    const name = email.split('@')[0];
    if (!window.confirm(
      `Reset ${name}'s progress for ${classId}?\n\n` +
      `This clears their lesson history (back to lesson 1) and the class's ` +
      `question and flag progress, as if the class had never been started. ` +
      `Question/flag progress is shared, so it also resets for any co-teachers of this class.\n\n` +
      `This cannot be undone.`
    )) return;
    resetClassProgress(classId, email);
    forceRefresh(n => n + 1);
  }

  const sessionLog = getSessionLog();
  const now = new Date();
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const thisTermStart = new Date(now.getFullYear(), now.getMonth() < 8 ? 0 : 8, 1);

  const classMap = new Map();
  for (const t of teachers) {
    if (t.class_id && !classMap.has(t.class_id)) classMap.set(t.class_id, t);
  }

  // Class overview: one sub-row per assigned teacher, with that teacher's
  // own progress for that particular class
  const classRows = Array.from(classMap.values()).map(t => {
    const teacherStats = teachers
      .filter(x => x.class_id === t.class_id && x.email)
      .map(x => {
        const sessions = sessionLog.filter(s => s.class_id === t.class_id && s.teacher_email === x.email);
        sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
        return {
          email: x.email,
          rota_id: x.rota_id,
          lastSession: sessions[0]?.opened_at || null,
          termSessions: sessions.filter(s => new Date(s.opened_at) >= thisTermStart).length,
          recentSessions: sessions.filter(s => new Date(s.opened_at) >= twoWeeksAgo).length,
        };
      });
    return { class_id: t.class_id, teacherStats };
  });

  // One row per teacher: overall usage across all of their classes
  const teacherAgg = new Map();
  for (const t of teachers) {
    if (!t.class_id || !t.email) continue;
    if (!teacherAgg.has(t.email)) teacherAgg.set(t.email, { email: t.email, classes: [] });
    teacherAgg.get(t.email).classes.push(t.class_id);
  }
  const teacherRows = Array.from(teacherAgg.values()).map(t => {
    const sessions = sessionLog.filter(s => s.teacher_email === t.email);
    sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
    return { ...t, totalSessions: sessions.length, lastSession: sessions[0]?.opened_at || null };
  }).sort((a, b) => b.totalSessions - a.totalSessions);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">← Back</button>
        <h1 className="text-xl font-bold text-blue-800">HoD Dashboard</h1>
      </header>

      {/* Lesson-order mismatch prompt */}
      {pendingOrder && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
            <h2 className="font-bold text-gray-800 text-lg mb-1">Lesson order differs from expected</h2>
            <p className="text-sm text-gray-500 mb-4">
              The uploaded file lists lessons in a different order to the natural (alphabetical) lesson order. Which order should the rota sequence use?
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-5">
              {pendingOrder.diffs.map(d => (
                <div key={d.topic} className="border border-gray-100 rounded-xl p-3">
                  <div className="text-sm font-semibold text-gray-700 mb-1">{d.topic}</div>
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-blue-700">Excel order:</span> {d.fileOrder.map(l => l.id).join(' → ')}
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="font-medium text-gray-600">Alphabetical:</span> {d.naturalOrder.map(l => l.id).join(' → ')}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => setPendingOrder(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={pendingOrder.onNatural} className="px-5 py-2 bg-white border-2 border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-400">
                Keep alphabetical order
              </button>
              <button onClick={pendingOrder.onExcel} className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800">
                Use Excel order
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-8">
        {/* Sidebar navigation */}
        <nav className="w-44 shrink-0">
          <div className="sticky top-8 space-y-1">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${section === item.id ? 'bg-blue-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content panel */}
        <main className="flex-1 min-w-0 space-y-10">

        {section === 'analytics' && (
        <>
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
                  {['Class', 'Teacher', 'Rota', 'Last session', 'This term', 'Last 2 weeks', 'Status', ''].map((h, i) => (
                    <th key={h || `col${i}`} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classRows.flatMap(row => {
                  if (row.teacherStats.length === 0) {
                    return [(
                      <tr key={row.class_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{row.class_id}</td>
                        <td className="px-4 py-3 text-gray-300 italic" colSpan={7}>No teachers assigned yet</td>
                      </tr>
                    )];
                  }
                  return row.teacherStats.map((ts, i) => (
                    <tr key={`${row.class_id}-${ts.email}`} className="hover:bg-gray-50">
                      {i === 0 && (
                        <td rowSpan={row.teacherStats.length} className="px-4 py-3 font-medium text-gray-800 align-top border-r border-gray-50">
                          {row.class_id}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-600">{ts.email.split('@')[0]}</td>
                      <td className="px-4 py-3 text-gray-500">{getRotaName(ts.rota_id)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {ts.lastSession ? new Date(ts.lastSession).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{ts.termSessions}</td>
                      <td className="px-4 py-3 text-gray-700">{ts.recentSessions}</td>
                      <td className="px-4 py-3 text-xl">{statusIcon(ts.lastSession)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleResetProgress(row.class_id, ts.email)}
                          disabled={!ts.lastSession}
                          title={ts.lastSession ? 'Reset this teacher’s progress for this class' : 'No progress to reset'}
                          className="text-xs font-semibold text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          ↺ Reset
                        </button>
                      </td>
                    </tr>
                  ));
                })}
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
                  {['Teacher', 'Classes', 'Total sessions', 'Last session'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teacherRows.map(row => (
                  <tr key={row.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{row.email}</td>
                    <td className="px-4 py-3 text-gray-500">{row.classes.join(', ')}</td>
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
        </>
        )}

        {section === 'questions' && (
        <>
        {/* ── Preview ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Preview</h2>
          <p className="text-sm text-gray-400 mb-4">
            Browse the lessons in teaching order and the questions in each. Pick a rota, then click a lesson.
          </p>
          <QuestionPreview />
        </section>

        {/* ── Question bank ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Question bank</h2>
          <p className="text-sm text-gray-400 mb-4">
            Edit questions / answers / scaffolds in Excel or Google Sheets, then re-upload. Upload the whole bank to replace everything, or upload individual topic files to update just those topics. Each row's <code>lesson_id</code> decides which lesson it belongs to; new rows can leave <code>id</code> blank.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${usingCustom ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {usingCustom ? `Custom questions active (${getActiveQuestions().length})` : `Default questions (${QUESTIONS.length})`}
              </span>
              {uploadStatus && (
                <span className="text-sm text-gray-500">{uploadStatus}</span>
              )}
            </div>

            {/* Downloads */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Download</div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={downloadCurrent}
                  className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
                >
                  ↓ Current bank
                </button>
                <button
                  onClick={downloadOriginal}
                  className="px-5 py-2 bg-white border-2 border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:border-gray-400 transition-colors"
                  title="Download the original bundled question bank"
                >
                  ↺ Original (default) bank
                </button>
              </div>
            </div>

            {/* Uploads */}
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upload</div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2 bg-white border-2 border-blue-300 text-blue-700 text-sm font-semibold rounded-xl hover:border-blue-500 transition-colors"
                >
                  ↑ Whole bank (replaces all)
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.csv" onChange={handleUpload} className="hidden" />

                <button
                  onClick={() => topicFileInputRef.current?.click()}
                  className="px-5 py-2 bg-white border-2 border-blue-300 text-blue-700 text-sm font-semibold rounded-xl hover:border-blue-500 transition-colors"
                >
                  ↑ Topic file(s) (replaces those topics)
                </button>
                <input ref={topicFileInputRef} type="file" accept=".xlsx,.csv" multiple onChange={handleTopicUpload} className="hidden" />

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
          </div>
        </section>

        {/* ── Version history ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Upload history</h2>
          <p className="text-sm text-gray-400 mb-4">
            The most recent {versions.length === 1 ? 'upload' : `${versions.length} uploads`} are kept. Redownload or restore any of them.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {versions.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">No uploads yet — the default question bank is in use.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['When', 'By', 'Change', 'Questions', ''].map((h, i) => (
                      <th key={h || `c${i}`} className="px-4 py-3 text-left text-gray-600 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {versions.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{new Date(v.at).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-500">{(v.by || '').split('@')[0]}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {v.kind === 'full' && 'Whole bank replaced'}
                        {v.kind === 'restore' && 'Restored a version'}
                        {v.kind === 'topic' && (
                          <span>Topics: <span className="text-gray-500">{(v.topics || []).join(', ') || '—'}</span></span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{v.questionCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => downloadVersion(v)} className="text-xs font-semibold text-blue-600 hover:text-blue-800 mr-3">↓ Download</button>
                        <button onClick={() => restoreVersion(v)} className="text-xs font-semibold text-gray-500 hover:text-amber-600">↺ Restore</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Per-topic input templates ── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">Per-topic input templates</h2>
          <p className="text-sm text-gray-400 mb-4">
            Download one file per topic to send to teachers. Each file has a Lesson dropdown — selecting a lesson auto-fills the lesson_id. Questions are pre-filled; 30 blank rows are included for new entries. Collate the returned files and re-upload using the question bank uploader above.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex flex-wrap gap-2">
              {topicList.map(({ name, count }) => (
                <a
                  key={name}
                  href={`/topic-templates/${topicFilename(name)}`}
                  download
                  className="px-4 py-2 bg-gray-100 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-700 text-sm font-medium rounded-lg transition-colors"
                >
                  ↓ {name} <span className="text-gray-400 font-normal">({count} lessons)</span>
                </a>
              ))}
            </div>
          </div>
        </section>
        </>
        )}

        {section === 'rotas' && (
          <section>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Rota sequencing</h2>
            <p className="text-sm text-gray-400 mb-4">
              Reorder the topics taught in each rota by dragging the cards.
            </p>
            <RotaEditor />
          </section>
        )}

        </main>
      </div>
    </div>
  );
}
