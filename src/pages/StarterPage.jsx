import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getQuestionLog, saveQuestionLog, upsertQuestionLogEntry, flushQuestionLogToFirestore, getActiveChallengePlus, saveActiveSession, getActiveSession, clearActiveSession } from '../utils/storage.js';
import { generateStarterQuestions, updateQuestionLog } from '../utils/scheduler.js';
import { ROTAS, LESSONS } from '../data/staticData.js';
import QuestionCard from '../components/QuestionCard.jsx';
import SettingsMenu from '../components/SettingsMenu.jsx';
import FlagResolutionModal from '../components/FlagResolutionModal.jsx';

const TIMER_TOTAL = 5 * 60;

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

// Placeholder slot left behind by a removed question — hover reveals a + to add one back
function EmptySlot({ onAdd }) {
  return (
    <div
      onClick={onAdd}
      className="group/slot h-full rounded-2xl border-2 border-dashed border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 flex items-center justify-center cursor-pointer transition-all"
      title="Add a question"
    >
      <span className="text-6xl font-light text-transparent group-hover/slot:text-blue-400 transition-colors select-none">+</span>
    </div>
  );
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
  // Show the challenge+ question from the PREVIOUS lesson (set last time, reviewed this lesson)
  const prevRotaEntry = teacher
    ? ROTAS.find(r => r.rota_id === teacher.rota_id && r.lesson_order === currentLessonOrder - 1)
    : null;
  const lessonData = rotaEntry ? LESSONS.find(l => l.lesson_id === rotaEntry.lesson_id) : null;
  const lessonTitle = lessonData?.lesson_title || `Lesson ${currentLessonOrder}`;
  const challengeQ = prevRotaEntry
    ? getActiveChallengePlus().find(c => c.lesson_id === prevRotaEntry.lesson_id)
    : null;

  // questions may contain null entries — placeholders where a question was removed
  const [questions, setQuestions] = useState([]);
  const [flagQueue, setFlagQueue] = useState([]);
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);
  const [showResolution, setShowResolution] = useState(false);
  const [scaffoldAll, setScaffoldAll] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
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

  function adjustTimer(delta) {
    setTimerSeconds(s => Math.max(0, Math.min(60 * 60, s + delta)));
  }

  const timerMM = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const timerSS = String(timerSeconds % 60).padStart(2, '0');
  const timerStarted = timerActive || timerSeconds < TIMER_TOTAL;

  useEffect(() => {
    if (!teacher) return;
    const saved = getActiveSession(decodedClassId, String(currentLessonOrder));
    if (saved?.questions?.some(Boolean)) {
      setQuestions(saved.questions);
    } else {
      const log = getQuestionLog();
      const qs = generateStarterQuestions(decodedClassId, currentLessonOrder, teacher.rota_id, log);
      setQuestions(qs);
    }
  }, []);

  useEffect(() => {
    if (questions.some(Boolean)) {
      saveActiveSession(decodedClassId, String(currentLessonOrder), questions);
    }
  }, [questions]);

  if (!teacher) {
    navigate('/');
    return null;
  }

  const liveQuestions = questions.filter(Boolean);

  function handleFlag(question) {
    const nowFlagged = !question.flagged;
    // Persist immediately so both teachers sharing this class see it
    upsertQuestionLogEntry(decodedClassId, question.id, {
      flagged: nowFlagged,
      // next_due_lesson: 0 so flagged questions surface for all co-teachers immediately
      ...(nowFlagged ? { next_due_lesson: 0 } : {}),
    });
    setQuestions(qs => qs.map(q =>
      q && q.id === question.id ? { ...q, flagged: nowFlagged } : q
    ));
  }

  function pickReplacement(excludeId = null) {
    const log = getQuestionLog();
    const currentIds = questions.filter(Boolean).map(q => q.id);
    const pool = generateStarterQuestions(decodedClassId, currentLessonOrder, teacher.rota_id, log)
      .filter(q => !currentIds.includes(q.id) && q.id !== excludeId);
    return pool[0] || null;
  }

  function handleSwap(question, idx) {
    const replacement = pickReplacement(question.id);
    if (replacement) {
      setQuestions(qs => qs.map((q, i) => i === idx ? replacement : q));
    }
  }

  function handleRemove(question, idx) {
    const log = getQuestionLog();
    const entry = log.find(e => e.class_id === decodedClassId && e.question_id === question.id);
    const pushBack = (entry?.next_due_lesson || currentLessonOrder) + 2;
    upsertQuestionLogEntry(decodedClassId, question.id, { next_due_lesson: pushBack });
    // Leave a placeholder slot so the question can be replaced via +
    setQuestions(qs => qs.map((q, i) => i === idx ? null : q));
  }

  function handleAddAt(idx) {
    const replacement = pickReplacement();
    if (replacement) {
      setQuestions(qs => qs.map((q, i) => i === idx ? replacement : q));
    }
  }

  function handleEndSession() {
    exitFullscreen();
    clearActiveSession(decodedClassId, String(currentLessonOrder));
    const log = getQuestionLog();
    const updated = updateQuestionLog(decodedClassId, liveQuestions, currentLessonOrder, log);
    saveQuestionLog(updated);
    flushQuestionLogToFirestore(decodedClassId);

    const flagged = liveQuestions.filter(q => q.flagged);
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

      <SettingsMenu
        timerSeconds={timerSeconds}
        timerActive={timerActive}
        onToggleTimer={toggleTimer}
        onAdjustTimer={adjustTimer}
        revealAll={revealAll}
        onToggleRevealAll={() => setRevealAll(r => !r)}
        scaffoldAll={scaffoldAll}
        onToggleScaffoldAll={() => setScaffoldAll(s => !s)}
        onExit={handleEndSession}
      />

      {/* Header: date left | title centre | timer countdown right — all sizes adapt to viewport */}
      <header className="relative flex items-center px-8 pt-6 pb-4 shrink-0 gap-4">
        <span
          className="text-gray-400 whitespace-nowrap shrink-0"
          style={{ fontSize: 'clamp(1.1rem, 2.6vw, 3rem)' }}
        >
          {formatDate(new Date())}
        </span>

        <h1
          className="flex-1 min-w-0 font-light text-gray-900 tracking-tight text-center leading-tight truncate"
          style={{ fontSize: 'clamp(1.75rem, 4.5vw, 4.5rem)' }}
        >
          {lessonTitle}
        </h1>

        {timerStarted ? (
          <span
            className={`font-mono font-bold tabular-nums whitespace-nowrap shrink-0 ${timerSeconds <= 60 ? 'text-red-500' : 'text-gray-700'}`}
            style={{ fontSize: 'clamp(1.25rem, 2.8vw, 3rem)' }}
          >
            {timerMM}:{timerSS}
          </span>
        ) : (
          /* Invisible spacer keeps the title centred when timer hidden */
          <span
            className="invisible font-mono font-bold whitespace-nowrap shrink-0"
            style={{ fontSize: 'clamp(1.25rem, 2.8vw, 3rem)' }}
            aria-hidden="true"
          >
            {formatDate(new Date()).length > 12 ? '' : '00:00'}
          </span>
        )}
      </header>

      {/* Extra space between header and grid */}
      <div className="shrink-0 h-4" />

      <main className="flex-1 min-h-0 flex flex-col gap-3 px-4 pb-4">
        {/* Grid: 2 cols × 3 rows — fills available height (6 questions) */}
        <div className="flex-[3] min-h-0 grid grid-cols-2 grid-rows-3 gap-3">
          {questions.map((q, i) => (
            q ? (
              <QuestionCard
                key={q.id}
                question={q}
                index={i}
                scaffoldAll={scaffoldAll}
                revealAll={revealAll}
                onFlag={handleFlag}
                onSwap={handleSwap}
                onRemove={handleRemove}
              />
            ) : (
              <EmptySlot key={`empty-${i}`} onAdd={() => handleAddAt(i)} />
            )
          ))}
          {liveQuestions.length === 0 && questions.length === 0 && (
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
          className={`shrink-0 w-full rounded-full bg-pink-100 px-8 py-5 flex items-center gap-6 ${challengeQ ? 'cursor-pointer select-none' : ''}`}
          onClick={() => challengeQ && setChallengeRevealed(r => !r)}
        >
          <span className="text-pink-400 font-bold text-2xl tracking-wide shrink-0">Challenge +</span>
          {challengeQ ? (
            <span className="text-gray-800 text-2xl font-medium">
              {challengeRevealed ? challengeQ.answer || challengeQ.question : challengeQ.question}
            </span>
          ) : (
            <span className="text-pink-200 text-2xl italic">Question to be added</span>
          )}
        </div>
      </main>
    </div>
  );
}
