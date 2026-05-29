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

function getRotaLessons(rotaId) {
  const entries = ROTAS.filter(r => r.rota_id === rotaId);
  entries.sort((a, b) => a.lesson_order - b.lesson_order);
  return entries;
}

function getLessonTitle(lessonId) {
  const l = LESSONS.find(l => l.lesson_id === lessonId);
  return l ? l.lesson_title : lessonId;
}

function getLessonNumber(lessonId) {
  const l = LESSONS.find(l => l.lesson_id === lessonId);
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
  const mySessions = sessionLog.filter(s => s.class_id === decodedClassId && s.teacher_email === email);
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

  function changeRota(newRotaId) {
    updateTeacherRota(decodedClassId, email, newRotaId);
    setRotaId(newRotaId);
    setIdx(0);
  }

  function startStarter() {
    if (!selectedRota) return;
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

      <main className="max-w-xl mx-auto px-6 py-16 flex flex-col items-center gap-8">
        <h2 className="text-lg font-semibold text-gray-600">Select lesson to start from</h2>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setIdx(i => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="text-3xl text-gray-400 hover:text-gray-700 disabled:opacity-20"
          >
            ‹
          </button>

          <div className="text-center">
            <div className="text-5xl font-bold text-blue-800 mb-1">
              {getLessonNumber(selectedRota.lesson_id) !== 'Assessment'
                ? `L${getLessonNumber(selectedRota.lesson_id)}`
                : 'Assessment'}
            </div>
            <div className="text-gray-600 text-lg">{getLessonTitle(selectedRota.lesson_id)}</div>
            <div className="text-gray-400 text-sm mt-1">Lesson {selectedRota.lesson_order} in rota</div>
          </div>

          <button
            onClick={() => setIdx(i => Math.min(rotaLessons.length - 1, i + 1))}
            disabled={idx === rotaLessons.length - 1}
            className="text-3xl text-gray-400 hover:text-gray-700 disabled:opacity-20"
          >
            ›
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
      </main>
    </div>
  );
}
