import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getQuestionLog, upsertQuestionLogEntry, getActiveChallengePlus, getActiveQuestions, saveActiveSession, getActiveSession, withMyEdits } from '../utils/storage.js';
import { generateStarterQuestions } from '../utils/scheduler.js';
import {
  getMySchedule, getDeliveredMap, getNextIndex, getOpenEntry, finalizeEntry,
  sessionKey, startTeach, needsReboarding, getNextLesson,
} from '../utils/schedule.js';
import { LESSONS } from '../data/staticData.js';
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

// /starter/:classId/:mode/:lessonId — mode is "preview" (nothing recorded) or
// "teach" (the lesson was recorded as taught when it was opened).
export default function StarterPage() {
  const { classId, mode, lessonId } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);
  const decodedLessonId = decodeURIComponent(lessonId);
  const isTeach = mode === 'teach';
  const classPath = `/lesson/${encodeURIComponent(decodedClassId)}`;

  const teachers = getTeachers();
  const email = getCurrentTeacher();
  const teacher = teachers.find(t => t.class_id === decodedClassId && t.email === email);

  // Teach runs against the schedule entry created when it was opened; preview
  // runs as if teaching the next lesson now.
  const openEntry = teacher && isTeach ? getOpenEntry(decodedClassId, email, decodedLessonId) : null;
  // Freeze the lesson index once known: it stays the same when a preview is
  // switched to Teach, and must survive the entry being finalised on end.
  const frozenIndex = useRef(null);
  const liveIndex = isTeach ? openEntry?.index : getNextIndex(decodedClassId, email);
  if (frozenIndex.current == null && liveIndex != null) frozenIndex.current = liveIndex;
  const lessonIndex = frozenIndex.current ?? liveIndex;
  const deliveredMap = getDeliveredMap(decodedClassId, email, lessonIndex);
  const cacheKey = sessionKey(lessonIndex, decodedLessonId);

  const lessonData = LESSONS.find(l => l.lesson_id === decodedLessonId);
  const lessonTitle = lessonData?.lesson_title || decodedLessonId;
  // Challenge+ comes from the lesson taught just before this one
  const prevLessonId = getMySchedule(decodedClassId, email).filter(e => e.index < lessonIndex).at(-1)?.lesson_id;
  const challengeQ = prevLessonId ? getActiveChallengePlus().find(c => c.lesson_id === prevLessonId) : null;
  const starterSize = teacher?.starter_size === 8 ? 8 : 6;
  // Today's lesson questions, with this teacher's own versions applied
  const outcomes = withMyEdits(getActiveQuestions().filter(q => q.lesson_id === decodedLessonId), email);

  // questions may contain null entries — placeholders where a question was removed
  const [questions, setQuestions] = useState([]);
  const [flagQueue, setFlagQueue] = useState([]);
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);
  const [showResolution, setShowResolution] = useState(false);
  const [scaffoldAll, setScaffoldAll] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  const [challengeRevealed, setChallengeRevealed] = useState(false);
  const [showOutcomes, setShowOutcomes] = useState(false);
  const [ended, setEnded] = useState(false);

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

  // Load the held question set (from an earlier preview or a reload), or build one
  useEffect(() => {
    if (!teacher || lessonIndex == null) return;
    const saved = getActiveSession(decodedClassId, cacheKey);
    if (saved?.questions?.some(Boolean)) {
      setQuestions(saved.questions);
    } else {
      setQuestions(generateStarterQuestions(decodedClassId, lessonIndex, deliveredMap, getQuestionLog(), starterSize));
    }
  }, []);

  useEffect(() => {
    if (lessonIndex != null && questions.some(Boolean)) {
      saveActiveSession(decodedClassId, cacheKey, questions);
    }
  }, [questions]);

  if (!teacher) return <Navigate to="/" replace />;
  // A taught lesson that's already been ended (or undone) can't be reopened
  if (isTeach && !openEntry && !ended) return <Navigate to={classPath} replace />;

  const liveQuestions = questions.filter(Boolean);
  // The teacher's own question edits are applied at display time, so an edit
  // made while previewing is what the class sees when it's taught
  const shownQuestions = withMyEdits(questions, email);
  const nextUp = getNextLesson(decodedClassId, email);
  const canTeachFromPreview = !isTeach && nextUp.lessonId === decodedLessonId && !needsReboarding(decodedClassId, email);

  function handleFlag(question) {
    const nowFlagged = !question.flagged;
    if (isTeach) {
      upsertQuestionLogEntry(decodedClassId, question.id, {
        flagged: nowFlagged,
        // Flag = the class struggled: surface again next lesson and restart
        // the repetition ladder so intervals start short
        ...(nowFlagged ? { next_due_lesson: 0, times_seen: 0 } : {}),
      });
    }
    setQuestions(qs => qs.map(q =>
      q && q.id === question.id ? { ...q, flagged: nowFlagged } : q
    ));
  }

  function pickReplacement(excludeId = null) {
    const currentIds = questions.filter(Boolean).map(q => q.id);
    const pool = generateStarterQuestions(decodedClassId, lessonIndex, deliveredMap, getQuestionLog(), starterSize + 6)
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
    if (isTeach) {
      // Push back relative to NOW so an overdue question doesn't reappear immediately
      upsertQuestionLogEntry(decodedClassId, question.id, { next_due_lesson: lessonIndex + 2 });
    }
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
    if (!isTeach) {
      // Preview: nothing recorded; the held question set is kept for teaching
      navigate(classPath);
      return;
    }
    setEnded(true);
    finalizeEntry(openEntry, liveQuestions);

    const flagged = liveQuestions.filter(q => q.flagged);
    if (flagged.length > 0) {
      setFlagQueue(flagged);
      setCurrentFlagIdx(0);
      setShowResolution(true);
    } else {
      navigate(classPath);
    }
  }

  function handleTeachNow() {
    startTeach(decodedClassId, email, decodedLessonId);
    navigate(`/starter/${encodeURIComponent(decodedClassId)}/teach/${encodeURIComponent(decodedLessonId)}`, { replace: true });
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
      next_due_lesson: lessonIndex + 1,
    });
    advanceFlagQueue();
  }

  function advanceFlagQueue() {
    if (currentFlagIdx + 1 < flagQueue.length) {
      setCurrentFlagIdx(i => i + 1);
    } else {
      setShowResolution(false);
      navigate(classPath);
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

      {!isTeach && (
        <div className="shrink-0 bg-amber-100 text-amber-800 text-sm px-6 py-2 flex items-center justify-center gap-4 flex-wrap">
          <span><strong>Preview</strong> — nothing is recorded. The questions you set here are the ones used when you teach this lesson.</span>
          {canTeachFromPreview && (
            <button onClick={handleTeachNow} className="bg-blue-700 text-white text-xs font-semibold px-3 py-1 rounded-full hover:bg-blue-800">
              Teach this lesson now
            </button>
          )}
          <button onClick={handleEndSession} className="text-amber-700 underline text-xs">Close preview</button>
        </div>
      )}

      {/* Header: date left | title centre | timer countdown right — all sizes adapt to viewport */}
      <header className="relative flex items-center justify-between px-8 pt-6 pb-4 shrink-0 gap-4">
        <span
          className="text-gray-400 whitespace-nowrap shrink-0"
          style={{ fontSize: 'clamp(1.1rem, 2.6vw, 3rem)' }}
        >
          {formatDate(new Date())}
        </span>

        <h1
          className="absolute left-1/2 -translate-x-1/2 max-w-[60%] truncate font-light text-gray-900 tracking-tight text-center leading-tight underline underline-offset-8 decoration-2"
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
            00:00
          </span>
        )}
      </header>

      {/* Extra space between header and grid */}
      <div className="shrink-0 h-4" />

      {showOutcomes ? (
        // ── Today's learning outcomes: the questions for the lesson about to be taught ──
        <main className="flex-1 min-h-0 flex flex-col px-12 pb-8">
          <h2 className="shrink-0 text-gray-400 font-semibold mb-6" style={{ fontSize: 'clamp(1.25rem, 2.2vw, 2.25rem)' }}>
            Today's learning outcomes
          </h2>
          {outcomes.length === 0 ? (
            <p className="text-gray-400 text-2xl">No questions have been written for this lesson yet.</p>
          ) : (
            <ol
              className="flex-1 min-h-0 overflow-y-auto list-decimal pl-12 space-y-4 text-gray-900 font-medium leading-snug"
              style={{ fontSize: 'clamp(1.25rem, 2.4vw, 2.5rem)' }}
            >
              {outcomes.map(q => <li key={q.id}>{q.question}</li>)}
            </ol>
          )}
          <div className="shrink-0 flex justify-between items-center mt-6">
            <button onClick={() => setShowOutcomes(false)} className="text-gray-400 hover:text-gray-700 text-lg">
              ← Back to starter
            </button>
            <button onClick={handleEndSession} className="bg-blue-700 text-white text-lg font-semibold px-6 py-3 rounded-2xl hover:bg-blue-800">
              {isTeach ? 'End starter' : 'Close preview'}
            </button>
          </div>
        </main>
      ) : (
        <main className="flex-1 min-h-0 flex flex-col gap-3 px-4 pb-4">
          {/* Grid: 2 cols × 3 rows (6 questions) or 2 × 4 (8 questions) */}
          <div className={`flex-[3] min-h-0 grid grid-cols-2 gap-3 ${questions.length > 6 ? 'grid-rows-4' : 'grid-rows-3'}`}>
            {shownQuestions.map((q, i) => (
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
            {questions.length === 0 && (
              <div className="col-span-2 row-span-3 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="text-3xl">No recall questions yet.</p>
                  <p className="text-xl mt-2">They build up from the lessons you've taught this class.</p>
                </div>
              </div>
            )}
          </div>

          {/* Challenge+ pill and the route on to today's learning outcomes */}
          <div className="shrink-0 flex gap-3">
            <div
              className={`flex-1 min-w-0 rounded-full bg-pink-100 px-8 py-5 flex items-center gap-6 ${challengeQ ? 'cursor-pointer select-none' : ''}`}
              onClick={() => challengeQ && setChallengeRevealed(r => !r)}
            >
              <span className="text-pink-400 font-bold text-2xl tracking-wide shrink-0">Challenge +</span>
              {challengeQ ? (
                <span className="text-gray-800 text-2xl font-medium truncate">
                  {challengeRevealed ? challengeQ.answer || challengeQ.question : challengeQ.question}
                </span>
              ) : (
                <span className="text-pink-200 text-2xl italic">Question to be added</span>
              )}
            </div>
            <button
              onClick={() => setShowOutcomes(true)}
              className="shrink-0 rounded-full bg-blue-700 text-white font-semibold px-6 text-lg hover:bg-blue-800 transition-colors"
            >
              See today's learning outcomes →
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
