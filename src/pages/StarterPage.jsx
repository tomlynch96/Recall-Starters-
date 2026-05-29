import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getQuestionLog, saveQuestionLog, upsertQuestionLogEntry } from '../utils/storage.js';
import { generateStarterQuestions, updateQuestionLog } from '../utils/scheduler.js';
import { ROTAS, LESSONS, CHALLENGE_PLUS } from '../data/staticData.js';
import QuestionCard from '../components/QuestionCard.jsx';
import FlagResolutionModal from '../components/FlagResolutionModal.jsx';

const TIMER_TOTAL = 5 * 60;

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function StarterPage() {
  const { classId, lessonOrder } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);
  const currentLessonOrder = Number(lessonOrder);

  const teachers = getTeachers();
  const email = getCurrentTeacher();
  const teacher = teachers.find(t => t.class_id === decodedClassId && t.email === email);

  const rotaEntry = teacher
    ? ROTAS.find(r => r.rota_id === teacher.rota_id && r.lesson_order === currentLessonOrder)
    : null;
  const lessonData = rotaEntry ? LESSONS.find(l => l.lesson_id === rotaEntry.lesson_id) : null;
  const lessonTitle = lessonData?.lesson_title || `Lesson ${currentLessonOrder}`;
  const challengeQ = rotaEntry ? CHALLENGE_PLUS.find(c => c.lesson_id === rotaEntry.lesson_id) : null;

  const [questions, setQuestions] = useState([]);
  const [flagQueue, setFlagQueue] = useState([]);
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);
  const [showResolution, setShowResolution] = useState(false);
  const [scaffoldAll, setScaffoldAll] = useState(false);
  const [challengeRevealed, setChallengeRevealed] = useState(false);

  // Timer state (lifted here so countdown stays visible in header)
  const [timerSeconds, setTimerSeconds] = useState(TIMER_TOTAL);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s - 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timerSeconds]);

  function toggleTimer() {
    if (!timerActive && timerSeconds === 0) setTimerSeconds(TIMER_TOTAL);
    setTimerActive(a => !a);
  }

  const timerMM = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const timerSS = String(timerSeconds % 60).padStart(2, '0');
  const timerStarted = timerActive || timerSeconds < TIMER_TOTAL;

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
    const nowFlagged = !question.flagged;
    // Persist immediately so both teachers sharing this class see it
    upsertQuestionLogEntry(decodedClassId, question.id, {
      flagged: nowFlagged,
      // next_due_lesson: 0 so flagged questions surface for all co-teachers immediately
      ...(nowFlagged ? { next_due_lesson: 0 } : {}),
    });
    setQuestions(qs => qs.map(q =>
      q.id === question.id ? { ...q, flagged: nowFlagged } : q
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
    <div className="h-screen overflow-hidden bg-white flex flex-col">
      {showResolution && (
        <FlagResolutionModal
          question={flagQueue[currentFlagIdx]}
          onFineNow={handleFineNow}
          onRevisit={handleRevisit}
        />
      )}

      {/* Icon menu — fixed top-right hover zone; icons only appear when this corner is hovered */}
      <div className="group fixed top-0 right-0 w-44 h-16 z-10 pointer-events-none">
        <div className="absolute top-4 right-5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
        <button
          onClick={() => setScaffoldAll(s => !s)}
          title={scaffoldAll ? 'Hide scaffolding' : 'Show scaffolding'}
          className={`text-xl leading-none transition-colors ${scaffoldAll ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500'}`}
        >
          [_]
        </button>
        <button
          onClick={toggleTimer}
          title={timerActive ? 'Pause timer' : timerStarted ? 'Resume timer' : 'Start timer'}
          className={`text-xl leading-none transition-colors ${timerActive ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-gray-500'}`}
        >
          {timerActive ? '⏸' : timerStarted ? '▶' : '⏱'}
        </button>
        <button
          onClick={handleEndSession}
          title="End session"
          className="text-3xl text-gray-300 hover:text-gray-600 leading-none"
        >
          ×
        </button>
        </div>
      </div>

      {/* Header: date left | title centre | timer countdown right (always visible when running) */}
      <header className="relative flex items-center px-8 pt-6 pb-4 shrink-0">
        <span className="text-gray-400 text-5xl">{formatDate(new Date())}</span>

        <h1 className="absolute inset-x-0 text-7xl font-light text-gray-900 tracking-tight text-center leading-tight pointer-events-none">
          {lessonTitle}
        </h1>

        {timerStarted && (
          <span className={`ml-auto font-mono text-5xl font-bold tabular-nums ${timerSeconds <= 60 ? 'text-red-500' : 'text-gray-700'}`}>
            {timerMM}:{timerSS}
          </span>
        )}
      </header>

      {/* Extra space between header and grid */}
      <div className="shrink-0 h-4" />

      <main className="flex-1 min-h-0 flex flex-col gap-3 px-4 pb-4">
        {/* Grid: 2 cols × 3 rows — fills available height (6 questions) */}
        <div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              scaffoldAll={scaffoldAll}
              onFlag={handleFlag}
              onSwap={handleSwap}
              onRemove={handleRemove}
            />
          ))}
          {questions.length === 0 && (
            <div className="col-span-2 row-span-3 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-3xl">No questions available yet.</p>
                <p className="text-xl mt-2">Start teaching lessons to build up the question bank.</p>
              </div>
            </div>
          )}
        </div>

        {/* Challenge+ pill — full-width, pastel pink */}
        <div
          className={`shrink-0 w-full rounded-full bg-pink-100 px-8 py-4 flex items-center gap-4 ${challengeQ ? 'cursor-pointer select-none' : ''}`}
          onClick={() => challengeQ && setChallengeRevealed(r => !r)}
        >
          <span className="text-pink-400 font-bold text-lg tracking-wide shrink-0">Challenge +</span>
          {challengeQ ? (
            <span className="text-gray-800 text-xl font-medium">
              {challengeRevealed ? challengeQ.answer || challengeQ.question : challengeQ.question}
            </span>
          ) : (
            <span className="text-pink-200 text-xl italic">Question to be added</span>
          )}
        </div>
      </main>
    </div>
  );
}
