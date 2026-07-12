import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  getTeachers,
  getCurrentTeacher,
  getQuestionLog,
  getSessionLog,
  upsertQuestionLogEntry,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
} from '../utils/storage.js';
import { generateFillerQuestions } from '../utils/fillerScheduler.js';
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

export default function FillerPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const decodedClassId = decodeURIComponent(classId);

  const fillerTitle = location.state?.fillerTitle || 'Filler Lesson';

  const teachers = getTeachers();
  const email = getCurrentTeacher();
  const teacher = teachers.find(t => t.class_id === decodedClassId && t.email === email);

  const [questions, setQuestions] = useState([]);
  const [flagQueue, setFlagQueue] = useState([]);
  const [currentFlagIdx, setCurrentFlagIdx] = useState(0);
  const [showResolution, setShowResolution] = useState(false);
  const [scaffoldAll, setScaffoldAll] = useState(false);
  const [revealAll, setRevealAll] = useState(false);

  // Timer state
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
    const saved = getActiveSession(decodedClassId, 'filler');
    if (saved?.questions?.some(Boolean)) {
      setQuestions(saved.questions);
    } else {
      const log = getQuestionLog();
      const sessionLog = getSessionLog();
      const qs = generateFillerQuestions(decodedClassId, teacher.rota_id, log, sessionLog);
      setQuestions(qs);
    }
  }, []);

  useEffect(() => {
    if (questions.some(Boolean)) {
      saveActiveSession(decodedClassId, 'filler', questions);
    }
  }, [questions]);

  if (!teacher) {
    navigate('/');
    return null;
  }

  const liveQuestions = questions.filter(Boolean);

  function handleFlag(question) {
    const nowFlagged = !question.flagged;
    upsertQuestionLogEntry(decodedClassId, question.id, {
      flagged: nowFlagged,
      ...(nowFlagged ? { next_due_lesson: 0 } : {}),
    });
    setQuestions(qs => qs.map(q =>
      q && q.id === question.id ? { ...q, flagged: nowFlagged } : q
    ));
  }

  function pickReplacement(excludeId = null) {
    const log = getQuestionLog();
    const sessionLog = getSessionLog();
    const currentIds = questions.filter(Boolean).map(q => q.id);
    const pool = generateFillerQuestions(decodedClassId, teacher.rota_id, log, sessionLog)
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
    // Filler sessions do NOT update SR schedule — just leave a placeholder slot
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
    clearActiveSession(decodedClassId, 'filler');
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
    // Keep flagged, but since filler doesn't have a lesson_order context,
    // set next_due_lesson to 0 so it surfaces in the next real starter
    upsertQuestionLogEntry(decodedClassId, q.id, {
      flagged: true,
      next_due_lesson: 0,
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

      {/* Header: date left | custom title centre | timer right — adaptive sizes */}
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
          {fillerTitle}
        </h1>

        {timerStarted ? (
          <span
            className={`font-mono font-bold tabular-nums whitespace-nowrap shrink-0 ${timerSeconds <= 60 ? 'text-red-500' : 'text-gray-700'}`}
            style={{ fontSize: 'clamp(1.25rem, 2.8vw, 3rem)' }}
          >
            {timerMM}:{timerSS}
          </span>
        ) : (
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

      {/* Grid: 2 cols × 3 rows */}
      <main className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-3 px-4 pb-4">
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
        {questions.length === 0 && (
          <div className="col-span-2 row-span-3 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-3xl">No questions available for a filler lesson yet.</p>
              <p className="text-xl mt-2">Teach some lessons first to build up the question bank.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
