import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, updateTeacherRota, updateTeacherStarterSize, appendSession, getActiveQuestions } from '../utils/storage.js';
import {
  getTeacher, getMySchedule, getClassTimeline, getRotaSequence, getNextLesson, setPlannedNext,
  needsReboarding, autoConfirmIfNew, autoFinalize, startTeach, undoLastLesson, recoverSchedule, isRecheck,
} from '../utils/schedule.js';
import { useHydrated } from '../utils/useHydrated.js';
import { topicColour, getLessonMeta, lessonLabel } from '../utils/topicColours.js';
import { generateUUID } from '../utils/uuid.js';
import HistoryEditor from '../components/HistoryEditor.jsx';
import LessonDrawer from '../components/LessonDrawer.jsx';

const ROTA_OPTIONS = [
  { id: 'rota-a', label: 'Rota A — Solo (6/fn)' },
  { id: 'rota-b-t1', label: 'Rota B — T1 (4/fn)' },
  { id: 'rota-b-t2', label: 'Rota B — T2 (2/fn)' },
  { id: 'rota-c-t1', label: 'Rota C — T1 (3/fn)' },
  { id: 'rota-c-t2', label: 'Rota C — T2 (3/fn)' },
];

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}

function firstName(email) {
  const raw = (email || '').split('@')[0].split(/[._-]/)[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function LessonPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);
  const enc = encodeURIComponent(decodedClassId);
  const email = getCurrentTeacher();
  const hydrated = useHydrated();

  const [, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);
  const [tab, setTab] = useState('mine');
  const [drawerLessonId, setDrawerLessonId] = useState(null);
  const [editingHistory, setEditingHistory] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showFillerInput, setShowFillerInput] = useState(false);
  const [fillerTitleInput, setFillerTitleInput] = useState('');
  const fillerInputRef = useRef(null);
  const scheduleEndRef = useRef(null);

  const teacher = getTeacher(decodedClassId, email);

  // Once fresh data is in: finish any starter left open, and skip the history
  // check for teachers with nothing to check
  useEffect(() => {
    if (!hydrated || !teacher) return;
    recoverSchedule(decodedClassId, email);
    autoFinalize(decodedClassId, email);
    autoConfirmIfNew(decodedClassId, email);
    refresh();
  }, [hydrated]);

  useEffect(() => {
    scheduleEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [hydrated, tab]);

  if (!teacher) return <Navigate to="/" replace />;

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading your lessons…</p>
      </div>
    );
  }

  const blocked = needsReboarding(decodedClassId, email);
  const schedule = getMySchedule(decodedClassId, email);
  const seq = getRotaSequence(teacher.rota_id);
  const next = getNextLesson(decodedClassId, email);
  const starterSize = teacher.starter_size === 8 ? 8 : 6;

  const taughtDates = new Map();
  for (const e of schedule) {
    if (!taughtDates.has(e.lesson_id)) taughtDates.set(e.lesson_id, []);
    taughtDates.get(e.lesson_id).push(e.taught_at);
  }
  const questionCount = new Map();
  for (const q of getActiveQuestions()) questionCount.set(q.lesson_id, (questionCount.get(q.lesson_id) || 0) + 1);

  function changeRota(newRotaId) {
    updateTeacherRota(decodedClassId, email, newRotaId);
    refresh();
  }

  function planNext(lessonId) {
    setPlannedNext(decodedClassId, email, lessonId === next.suggested ? null : lessonId);
    setDrawerLessonId(null);
    refresh();
  }

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function teach() {
    if (blocked || !next.lessonId) return;
    goFullscreen();
    startTeach(decodedClassId, email, next.lessonId);
    navigate(`/starter/${enc}/teach/${encodeURIComponent(next.lessonId)}`);
  }

  function preview() {
    if (!next.lessonId) return;
    goFullscreen();
    navigate(`/starter/${enc}/preview/${encodeURIComponent(next.lessonId)}`);
  }

  function undo() {
    const last = schedule[schedule.length - 1];
    if (!last) return;
    if (!window.confirm(`Undo "${lessonLabel(last.lesson_id)}"? It will be removed from your lesson schedule.`)) return;
    const result = undoLastLesson(decodedClassId, email);
    if (result && !result.restored && last.source === 'teach') {
      window.alert('Removed from your schedule. The recall progress from that lesson was kept, because it was taught on another device.');
    }
    refresh();
  }

  function startFiller() {
    const title = fillerTitleInput.trim() || 'Filler Lesson';
    goFullscreen();
    appendSession({
      id: generateUUID(),
      class_id: decodedClassId,
      teacher_email: email,
      lesson_order: -1,
      lesson_id: null,
      opened_at: new Date().toISOString(),
    });
    navigate(`/filler/${enc}`, { state: { fillerTitle: title } });
  }

  function lessonStatus(lessonId) {
    const dates = taughtDates.get(lessonId);
    if (dates) {
      const last = dates[dates.length - 1];
      return `Taught${dates.length > 1 ? ` ${dates.length}×` : ''}${last ? ` · ${formatDay(last)}` : ''}`;
    }
    if (lessonId === next.lessonId) return 'Up next';
    return 'Not taught yet';
  }

  const classTeachers = getTeachers().filter(t => t.class_id === decodedClassId && t.email);
  const timeline = getClassTimeline(decodedClassId);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-wrap">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">← Back</button>
        <h1 className="text-xl font-bold text-blue-800">{decodedClassId}</h1>
        <select
          value={teacher.rota_id}
          onChange={e => changeRota(e.target.value)}
          className="text-sm text-gray-500 border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:border-blue-500"
        >
          {ROTA_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <Link to={`/dashboard/${enc}`} className="ml-auto text-blue-600 hover:underline text-sm">View Dashboard</Link>
      </header>

      {drawerLessonId && (
        <LessonDrawer
          lessonId={drawerLessonId}
          email={email}
          status={lessonStatus(drawerLessonId)}
          onClose={() => setDrawerLessonId(null)}
          onPlan={blocked || drawerLessonId === next.lessonId ? null : () => planNext(drawerLessonId)}
          planLabel={taughtDates.has(drawerLessonId) ? 'Teach this again next' : 'Teach this next'}
        />
      )}

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* ── Browse: look at any lesson, never recorded ── */}
        <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Browse lessons</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Click a lesson to see its questions — looking never records anything.
              {!blocked && ' Drag a lesson onto your schedule to teach it next.'}
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto pb-2">
            {seq.map((lessonId, i) => {
              const meta = getLessonMeta(lessonId);
              const topic = meta?.topic_name || 'Unknown';
              const showTopic = i === 0 || getLessonMeta(seq[i - 1])?.topic_name !== topic;
              const taught = taughtDates.has(lessonId);
              const isNext = !blocked && lessonId === next.lessonId;
              return (
                <div key={lessonId}>
                  {showTopic && (
                    <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${topicColour(topic).dot}`} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{topic}</span>
                    </div>
                  )}
                  <div
                    draggable={!blocked}
                    onDragStart={e => e.dataTransfer.setData('text/plain', lessonId)}
                    onClick={() => setDrawerLessonId(lessonId)}
                    className={`group flex items-center gap-3 px-5 py-2 cursor-pointer border-l-4 transition-colors ${
                      isNext ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    {!blocked && <span className="text-gray-300 group-hover:text-gray-500 cursor-grab select-none" title="Drag to your schedule">⠿</span>}
                    <span className={`w-5 text-center text-sm ${taught ? 'text-green-600' : 'text-gray-300'}`}>{taught ? '✓' : '·'}</span>
                    <span className={`flex-1 text-sm ${taught ? 'text-gray-500' : 'text-gray-800'}`}>{lessonLabel(lessonId)}</span>
                    {isNext && <span className="text-xs font-semibold text-blue-600">next</span>}
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{questionCount.get(lessonId) || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Schedule (or the one-off history check) ── */}
        <section className="space-y-4">
          {blocked || editingHistory ? (
            <HistoryEditor
              classId={decodedClassId}
              email={email}
              rotaId={teacher.rota_id}
              mode={blocked ? 'reboard' : 'edit'}
              recheck={blocked && isRecheck(decodedClassId, email)}
              onDone={() => { setEditingHistory(false); refresh(); }}
              onCancel={blocked ? null : () => setEditingHistory(false)}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="flex border-b border-gray-100 text-sm">
                {[['mine', 'My schedule'], ['class', 'Class timeline']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex-1 py-3 font-semibold ${tab === id ? 'text-blue-700 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'mine' ? (
                <div className="p-4">
                  <div className="max-h-[40vh] overflow-y-auto space-y-1 pr-1">
                    {schedule.length === 0 && (
                      <p className="text-sm text-gray-400 italic px-1">No lessons taught yet.</p>
                    )}
                    {schedule.map(e => (
                      <div key={e.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm">
                        <span className="w-6 text-right text-xs font-mono text-gray-400">{e.index}</span>
                        <span className="text-green-600">✓</span>
                        <span className="flex-1 text-gray-700 truncate">{lessonLabel(e.lesson_id)}</span>
                        <span className="text-xs text-gray-400">{formatDay(e.taught_at)}</span>
                      </div>
                    ))}
                    <div ref={scheduleEndRef} />
                  </div>

                  {/* Next slot: ghosted suggestion unless a lesson has been dragged in */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) planNext(id); }}
                    className={`mt-3 rounded-xl border-2 px-4 py-4 transition-colors ${
                      dragOver ? 'border-blue-500 bg-blue-50'
                        : next.planned ? 'border-blue-300 bg-white'
                          : 'border-dashed border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-right text-xs font-mono text-gray-400">{schedule.length + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                          {next.planned ? 'Next — your choice' : 'Suggested next'}
                        </div>
                        <div className={`text-base font-semibold truncate ${next.planned ? 'text-gray-800' : 'text-gray-500 italic'}`}>
                          {next.lessonId ? lessonLabel(next.lessonId) : 'Every lesson in your rota is taught'}
                        </div>
                      </div>
                    </div>
                    {next.planned && next.suggested && (
                      <button onClick={() => planNext(null)} className="mt-2 ml-9 text-xs text-gray-400 hover:text-gray-600">
                        × Back to the suggestion ({lessonLabel(next.suggested)})
                      </button>
                    )}
                    <p className="mt-2 ml-9 text-xs text-gray-400">Drag any lesson here to teach it instead.</p>
                    <div className="mt-3 ml-9 flex gap-2">
                      <button
                        onClick={preview}
                        disabled={!next.lessonId}
                        className="flex-1 py-2.5 rounded-xl border-2 border-blue-200 text-blue-700 font-semibold hover:border-blue-400 disabled:opacity-40"
                      >
                        Preview
                      </button>
                      <button
                        onClick={teach}
                        disabled={!next.lessonId}
                        className="flex-1 py-2.5 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-40"
                      >
                        Teach
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <button onClick={() => setEditingHistory(true)} className="text-gray-400 hover:text-gray-600 underline">
                      Edit lesson history
                    </button>
                    {schedule.length > 0 && (
                      <button onClick={undo} className="text-gray-400 hover:text-red-500 underline">
                        Undo last lesson
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-2">
                    Every lesson taught to {decodedClassId}{classTeachers.length > 1 ? ', by all its teachers' : ''}.
                  </p>
                  <div className="max-h-[55vh] overflow-y-auto space-y-1">
                    {timeline.length === 0 && <p className="text-sm text-gray-400 italic">Nothing taught yet.</p>}
                    {timeline.map(e => (
                      <div key={e.id} className="flex items-center gap-3 px-2 py-1.5 text-sm">
                        <span className="text-xs text-gray-400 w-14 shrink-0">{formatDay(e.taught_at)}</span>
                        <span className="flex-1 text-gray-700 truncate">{lessonLabel(e.lesson_id)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${e.teacher_email === email ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {e.teacher_email === email ? 'You' : firstName(e.teacher_email)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Starter size + filler lessons */}
          {!blocked && !editingHistory && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Questions per starter:</span>
                {[6, 8].map(size => (
                  <button
                    key={size}
                    onClick={() => { updateTeacherStarterSize(decodedClassId, email, size); refresh(); }}
                    className={`w-8 h-8 rounded-full text-sm font-semibold transition-colors ${
                      starterSize === size ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              {!showFillerInput ? (
                <button
                  onClick={() => { setShowFillerInput(true); setTimeout(() => fillerInputRef.current?.focus(), 0); }}
                  className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  Run a filler lesson (doesn't change your schedule)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={fillerInputRef}
                    type="text"
                    value={fillerTitleInput}
                    onChange={e => setFillerTitleInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') startFiller(); if (e.key === 'Escape') setShowFillerInput(false); }}
                    placeholder="e.g. Cover lesson, Revision"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button onClick={startFiller} className="bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700">Go</button>
                  <button onClick={() => setShowFillerInput(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1" title="Cancel">×</button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
