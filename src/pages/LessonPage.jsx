import { useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, updateTeacherRota, appendSession } from '../utils/storage.js';
import { ROTAS, LESSONS } from '../data/staticData.js';
import { generateUUID } from '../utils/uuid.js';

const ROTA_OPTIONS = [
  { id: 'rota-a', label: 'Rota A — Solo (6/fn)' },
  { id: 'rota-b-t1', label: 'Rota B — T1 (4/fn)' },
  { id: 'rota-b-t2', label: 'Rota B — T2 (2/fn)' },
  { id: 'rota-c-t1', label: 'Rota C — T1 (3/fn)' },
  { id: 'rota-c-t2', label: 'Rota C — T2 (3/fn)' },
];

// Pastel palette cycled per topic in the schedule strip
const TOPIC_COLOURS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  'bg-emerald-100 text-emerald-800 border-emerald-200',
  'bg-sky-100 text-sky-800 border-sky-200',
  'bg-violet-100 text-violet-800 border-violet-200',
];

function getRotaLessons(rotaId) {
  const entries = ROTAS.filter(r => r.rota_id === rotaId);
  entries.sort((a, b) => a.lesson_order - b.lesson_order);
  return entries;
}

function getLesson(lessonId) {
  return LESSONS.find(l => l.lesson_id === lessonId) || null;
}

function getLessonTitle(lessonId) {
  const l = getLesson(lessonId);
  return l ? l.lesson_title : lessonId;
}

function getLessonNumber(lessonId) {
  const l = getLesson(lessonId);
  return l ? l.lesson_number : '';
}

export default function LessonPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);

  const teachers = getTeachers();
  const email = getCurrentTeacher();
  const teacher = teachers.find(t => t.class_id === decodedClassId && t.email === email);

  const initialRotaId = teacher?.rota_id || 'rota-a';
  const sessionLog = getSessionLog();
  const mySessions = sessionLog.filter(s => s.class_id === decodedClassId && s.teacher_email === email && s.lesson_order !== -1);
  mySessions.sort((a, b) => b.lesson_order - a.lesson_order);
  const lastCompletedOrder = mySessions.length > 0 ? mySessions[0].lesson_order : 0;
  const initialRotaLessons = getRotaLessons(initialRotaId);
  const defaultIdx = initialRotaLessons.findIndex(r => r.lesson_order > lastCompletedOrder);
  const startIdx = defaultIdx === -1 ? Math.max(0, initialRotaLessons.length - 1) : defaultIdx;

  const [rotaId, setRotaId] = useState(initialRotaId);
  const [idx, setIdx] = useState(startIdx);
  const [showFillerInput, setShowFillerInput] = useState(false);
  const [fillerTitleInput, setFillerTitleInput] = useState('');
  const fillerInputRef = useRef(null);

  if (!teacher) {
    navigate('/');
    return null;
  }

  const rotaLessons = getRotaLessons(rotaId);
  const selectedRota = rotaLessons[Math.min(idx, rotaLessons.length - 1)];
  const prevRota = idx > 0 ? rotaLessons[idx - 1] : null;
  const nextRota = idx < rotaLessons.length - 1 ? rotaLessons[idx + 1] : null;

  // Topic → colour index for the schedule strip, in order of first appearance
  const topicColourMap = new Map();
  for (const r of rotaLessons) {
    const lesson = getLesson(r.lesson_id);
    const topic = lesson?.topic_name || 'Unknown';
    if (!topicColourMap.has(topic)) {
      topicColourMap.set(topic, TOPIC_COLOURS[topicColourMap.size % TOPIC_COLOURS.length]);
    }
  }

  function changeRota(newRotaId) {
    updateTeacherRota(decodedClassId, email, newRotaId);
    setRotaId(newRotaId);
    setIdx(0);
  }

  function startStarter() {
    if (!selectedRota) return;
    // Go fullscreen for the class display
    document.documentElement.requestFullscreen?.().catch(() => {});
    const entry = {
      id: generateUUID(),
      class_id: decodedClassId,
      teacher_email: email,
      lesson_order: selectedRota.lesson_order,
      lesson_id: selectedRota.lesson_id,
      opened_at: new Date().toISOString(),
    };
    appendSession(entry);
    navigate(`/starter/${encodeURIComponent(decodedClassId)}/${selectedRota.lesson_order}`);
  }

  function openFillerInput() {
    setShowFillerInput(true);
    setTimeout(() => fillerInputRef.current?.focus(), 0);
  }

  function startFiller() {
    const title = fillerTitleInput.trim() || 'Filler Lesson';
    document.documentElement.requestFullscreen?.().catch(() => {});
    const entry = {
      id: generateUUID(),
      class_id: decodedClassId,
      teacher_email: email,
      lesson_order: -1,
      lesson_id: null,
      opened_at: new Date().toISOString(),
    };
    appendSession(entry);
    navigate(`/filler/${encodeURIComponent(decodedClassId)}`, {
      state: { fillerTitle: title },
    });
  }

  if (!selectedRota) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">No lessons available for this rota.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-blue-800">{decodedClassId}</h1>
        <select
          value={rotaId}
          onChange={e => changeRota(e.target.value)}
          className="text-sm text-gray-500 border border-gray-200 rounded-lg px-2 py-1 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:border-blue-500"
        >
          {ROTA_OPTIONS.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
        <h2 className="text-lg font-semibold text-gray-600">Select lesson to start from</h2>

        {/* Last | Today | Next */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 w-full">
          {/* Previous lesson */}
          <button
            onClick={() => prevRota && setIdx(i => i - 1)}
            disabled={!prevRota}
            className="text-right group disabled:opacity-0 disabled:pointer-events-none"
            title="Go to previous lesson"
          >
            <div className="text-xs uppercase tracking-wide text-gray-300 group-hover:text-gray-400 mb-1">‹ Last lesson</div>
            <div className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors leading-snug">
              {prevRota && getLessonTitle(prevRota.lesson_id)}
            </div>
          </button>

          {/* Today's lesson */}
          <div className="text-center px-6">
            <div className="text-5xl font-bold text-blue-800 mb-1 whitespace-nowrap">
              {getLessonNumber(selectedRota.lesson_id) !== 'Assessment'
                ? `L${getLessonNumber(selectedRota.lesson_id)}`
                : 'Assessment'}
            </div>
            <div className="text-gray-700 text-lg font-medium">{getLessonTitle(selectedRota.lesson_id)}</div>
            <div className="text-gray-400 text-sm mt-1">Lesson {selectedRota.lesson_order} in rota</div>
          </div>

          {/* Next lesson */}
          <button
            onClick={() => nextRota && setIdx(i => i + 1)}
            disabled={!nextRota}
            className="text-left group disabled:opacity-0 disabled:pointer-events-none"
            title="Go to next lesson"
          >
            <div className="text-xs uppercase tracking-wide text-gray-300 group-hover:text-gray-400 mb-1">Next lesson ›</div>
            <div className="text-sm text-gray-400 group-hover:text-gray-600 transition-colors leading-snug">
              {nextRota && getLessonTitle(nextRota.lesson_id)}
            </div>
          </button>
        </div>

        <button
          onClick={startStarter}
          className="w-full max-w-xs bg-blue-700 text-white text-xl font-bold py-4 rounded-2xl hover:bg-blue-800 transition-colors shadow-md"
        >
          Start Starter
        </button>

        {/* Filler lesson section */}
        {!showFillerInput ? (
          <button
            onClick={openFillerInput}
            className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
          >
            Add filler lesson
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full max-w-xs">
            <input
              ref={fillerInputRef}
              type="text"
              value={fillerTitleInput}
              onChange={e => setFillerTitleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') startFiller(); if (e.key === 'Escape') setShowFillerInput(false); }}
              placeholder="e.g. Cover lesson, Revision"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={startFiller}
              className="bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go
            </button>
            <button
              onClick={() => setShowFillerInput(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
              title="Cancel"
            >
              ×
            </button>
          </div>
        )}

        <Link
          to={`/dashboard/${encodeURIComponent(decodedClassId)}`}
          className="text-blue-600 hover:underline text-sm"
        >
          View Dashboard
        </Link>

        {/* ── Full schedule — colour changes with each new topic ── */}
        <section className="w-full mt-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Lesson schedule</h3>
          <div className="flex flex-wrap gap-1.5">
            {rotaLessons.map((r, i) => {
              const lesson = getLesson(r.lesson_id);
              const topic = lesson?.topic_name || 'Unknown';
              const colours = topicColourMap.get(topic);
              const isCurrent = i === idx;
              const isDone = r.lesson_order <= lastCompletedOrder;
              return (
                <button
                  key={`${r.lesson_id}-${r.lesson_order}`}
                  onClick={() => setIdx(i)}
                  title={`${topic} — ${lesson?.lesson_title || r.lesson_id} (lesson ${r.lesson_order} in rota)`}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${colours} ${
                    isCurrent
                      ? 'ring-2 ring-blue-500 ring-offset-1 scale-105'
                      : isDone
                        ? 'opacity-40 hover:opacity-70'
                        : 'hover:scale-105'
                  }`}
                >
                  {lesson?.lesson_number === 'Assessment' ? 'A' : `L${lesson?.lesson_number || '?'}`}
                  <span className="block text-[10px] font-normal opacity-70 max-w-[72px] truncate">
                    {lesson?.lesson_title || r.lesson_id}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Topic legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {Array.from(topicColourMap.entries()).map(([topic, colours]) => (
              <span key={topic} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-3 h-3 rounded ${colours.split(' ')[0]}`} />
                {topic}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
