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
import FlagResolutionModal from '../components/FlagResolutionModal.jsx';

const TIMER_TOTAL = 5 * 60;

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
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

  const timerMM = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const timerSS = String(timerSeconds % 60).padStart(2, '0');
  const timerStarted = timerActive || timerSeconds < TIMER_TOTAL;

  useEffect(() => {
    if (!teacher) return;
    const saved = getActiveSession(decodedClassId, 'filler');
    if (saved?.questions?.length > 0) {
      setQuestions(saved.questions);
    } else {
      const log = getQuestionLog();
      const sessionLog = getSessionLog();
      const qs = generateFillerQuestions(decodedClassId, teacher.rota_id, log, sessionLog);
      setQuestions(qs);
    }
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      saveActiveSession(decodedClassId, 'filler', questions);
    }
  }, [questions]);

  if (!teacher) {
    navigate('/');
    return null;
  }

  function handleFlag(question) {
    const nowFlagged = !question.flagged;
    upsertQuestionLogEntry(decodedClassId, question.id, {
      flagged: nowFlagged,
      ...(nowFlagged ? { next_due_lesson: 0 } : {}),
    });
    setQuestions(qs => qs.map(q =>
      q.id === question.id ? { ...q, flagged: nowFlagged } : q
    ));
  }

  function handleSwap(question, idx) {
    const log = getQuestionLog();
    const sessionLog = getSessionLog();
    const currentIds = questions.map(q => q.id);
    const pool = generateFillerQuestions(decodedClassId, teacher.rota_id, log, sessionLog);
    const available = pool.filter(q => !currentIds.includes(q.id));
    if (available.length > 0) {
      setQuestions(qs => qs.map((q, i) => i === idx ? available[0] : q));
    }
  }

  function handleRemove(question, idx) {
    // Filler sessions do NOT update SR schedule — just remove from UI
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  }

  function handleEndSession() {
    clearActiveSession(decodedClassId, 'filler');
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

      {/* Icon menu — fixed top-right hover zone */}
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

      {/* Header: date left | custom title centre | timer countdown right */}
      <header className="relative flex items-center px-8 pt-6 pb-4 shrink-0">
        <span className="text-gray-400 text-5xl">{formatDate(new Date())}</span>

        <h1 className="absolute inset-x-0 text-7xl font-light text-gray-900 tracking-tight text-center leading-tight pointer-events-none">
          {fillerTitle}
        </h1>

        {timerStarted && (
          <span className={`ml-auto font-mono text-5xl font-bold tabular-nums ${timerSeconds <= 60 ? 'text-red-500' : 'text-gray-700'}`}>
            {timerMM}:{timerSS}
          </span>
        )}
      </header>

      {/* Extra space between header and grid */}
      <div className="shrink-0 h-4" />

      {/* Grid: 2 cols × 3 rows */}
      <main className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-3 px-4 pb-4">
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
              <p className="text-3xl">No questions available for a filler lesson yet.</p>
              <p className="text-xl mt-2">Teach some lessons first to build up the question bank.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
