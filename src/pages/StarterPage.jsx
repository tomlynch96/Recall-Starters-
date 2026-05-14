import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTeachers, getQuestionLog, saveQuestionLog, upsertQuestionLogEntry } from '../utils/storage.js';
import { generateStarterQuestions, updateQuestionLog } from '../utils/scheduler.js';
import { ROTAS, LESSONS } from '../data/staticData.js';
import QuestionCard from '../components/QuestionCard.jsx';
import Timer from '../components/Timer.jsx';
import FlagResolutionModal from '../components/FlagResolutionModal.jsx';

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StarterPage() {
  const { classId, lessonOrder } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);
  const currentLessonOrder = Number(lessonOrder);

  const teachers = getTeachers();
  const teacher = teachers.find(t => t.class_id === decodedClassId);

  const rotaEntry = teacher
    ? ROTAS.find(r => r.rota_id === teacher.rota_id && r.lesson_order === currentLessonOrder)
    : null;
  const lessonData = rotaEntry ? LESSONS.find(l => l.lesson_id === rotaEntry.lesson_id) : null;
  const lessonTitle = lessonData?.lesson_title || `Lesson ${currentLessonOrder}`;

  const [questions, setQuestions] = useState([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [flagQueue, setFlagQueue] = useState([]);
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);
  const [showResolution, setShowResolution] = useState(false);

  useEffect(() => {
    if (!teacher) return;
    const log = getQuestionLog();
    const qs = generateStarterQuestions(decodedClassId, currentLessonOrder, teacher.rota_id, log);
    setQuestions(qs);
  }, []);

  if (!teacher) {
    navigate('/');
    return null;
  }

  function handleFlag(question) {
    setQuestions(qs => qs.map(q =>
      q.id === question.id ? { ...q, flagged: !q.flagged } : q
    ));
  }

  function handleSwap(question, idx) {
    const log = getQuestionLog();
    const currentIds = questions.map(q => q.id);
    const eligible = generateStarterQuestions(decodedClassId, currentLessonOrder, teacher.rota_id, log)
      .filter(q => !currentIds.includes(q.id) || q.id === question.id);
    const replacement = eligible.find(q => q.id !== question.id);
    if (replacement) {
      setQuestions(qs => qs.map((q, i) => i === idx ? replacement : q));
    }
  }

  function handleRemove(question, idx) {
    const log = getQuestionLog();
    const entry = log.find(e => e.class_id === decodedClassId && e.question_id === question.id);
    const timeSeen = entry ? entry.times_seen : 0;
    const pushBack = (entry?.next_due_lesson || currentLessonOrder) + 2;
    upsertQuestionLogEntry(decodedClassId, question.id, { next_due_lesson: pushBack });
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  }

  function handleEndSession() {
    const log = getQuestionLog();
    const updated = updateQuestionLog(decodedClassId, questions, currentLessonOrder, log);
    saveQuestionLog(updated);

    const flagged = questions.filter(q => q.flagged);
    if (flagged.length > 0) {
      setFlagQueue(flagged);
      setCurrentFlagIdx(0);
      setShowResolution(true);
    } else {
      navigate(`/lesson/${encodeURIComponent(decodedClassId)}`);
    }
  }

  function handleFineNow() {
    const q = flagQueue[currentFlagIdx];
    upsertQuestionLogEntry(decodedClassId, q.id, {
      flagged: false,
      flag_resolved: true,
    });
    advanceFlagQueue();
  }

  function handleRevisit() {
    const q = flagQueue[currentFlagIdx];
    upsertQuestionLogEntry(decodedClassId, q.id, {
      flagged: true,
      next_due_lesson: currentLessonOrder + 1,
    });
    advanceFlagQueue();
  }

  function advanceFlagQueue() {
    if (currentFlagIdx + 1 < flagQueue.length) {
      setCurrentFlagIdx(i => i + 1);
    } else {
      setShowResolution(false);
      navigate(`/lesson/${encodeURIComponent(decodedClassId)}`);
    }
  }

  return (
    <div className="group/page h-screen overflow-hidden bg-white flex flex-col">
      {showResolution && (
        <FlagResolutionModal
          question={flagQueue[currentFlagIdx]}
          onFineNow={handleFineNow}
          onRevisit={handleRevisit}
        />
      )}

      {/* × end button — fixed top-right, invisible until page hover */}
      <button
        onClick={handleEndSession}
        className="fixed top-4 right-5 text-4xl text-gray-300 hover:text-gray-600 opacity-0 group-hover/page:opacity-100 transition-opacity z-10 leading-none"
        title="End session"
      >
        ×
      </button>

      {/* Header: date left | title centre | timer right — use absolute positioning for true centering */}
      <header className="relative flex items-center px-8 pt-6 pb-4 shrink-0">
        <span className="text-gray-400 text-5xl">{formatDate(new Date())}</span>

        <h1 className="absolute inset-x-0 text-7xl font-light text-gray-900 tracking-tight text-center leading-tight pointer-events-none">
          {lessonTitle}
        </h1>

        <div className="ml-auto">
          <Timer />
        </div>
      </header>

      {/* Extra space between header and grid */}
      <div className="shrink-0 h-4" />

      {/* Grid: 2 cols × 4 rows — fills all remaining height */}
      <main className="flex-1 min-h-0 grid grid-cols-2 grid-rows-4 gap-3 px-4 pb-4">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            onFlag={handleFlag}
            onSwap={handleSwap}
            onRemove={handleRemove}
          />
        ))}
        {questions.length === 0 && (
          <div className="col-span-2 row-span-4 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-3xl">No questions available yet.</p>
              <p className="text-xl mt-2">Start teaching lessons to build up the question bank.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
