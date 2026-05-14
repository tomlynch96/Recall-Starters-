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
    <div className="min-h-screen bg-white flex flex-col">
      {showResolution && (
        <FlagResolutionModal
          question={flagQueue[currentFlagIdx]}
          onFineNow={handleFineNow}
          onRevisit={handleRevisit}
        />
      )}

      {/* Top bar: date left, class centre-ish, timer right */}
      <header className="flex items-center justify-between px-6 pt-4 pb-2">
        <span className="text-gray-500 text-sm w-48">{formatDate(new Date())}</span>

        {/* Lesson title — centred */}
        <h1 className="text-4xl font-light text-gray-900 tracking-tight text-center flex-1">
          {lessonTitle}
        </h1>

        <div className="flex items-center justify-end gap-3 w-48">
          <Timer />
          <button
            onClick={handleEndSession}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            End
          </button>
        </div>
      </header>

      {/* Instruction sub-line */}
      <p className="text-center text-gray-500 text-sm mb-4 font-medium">
        Answer these questions in your book
      </p>

      <main className="flex-1 px-4 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
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
          <div className="col-span-2 text-center py-20 text-gray-400">
            <p className="text-xl">No questions available yet.</p>
            <p className="text-sm mt-2">Start teaching lessons to build up the question bank.</p>
          </div>
        )}
      </main>
    </div>
  );
}
