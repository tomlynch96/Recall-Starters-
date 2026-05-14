import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTeachers, getQuestionLog, saveQuestionLog, upsertQuestionLogEntry } from '../utils/storage.js';
import { generateStarterQuestions, updateQuestionLog, calculateNextDue } from '../utils/scheduler.js';
import { QUESTIONS } from '../data/staticData.js';
import QuestionCard from '../components/QuestionCard.jsx';
import Timer from '../components/Timer.jsx';
import FlagResolutionModal from '../components/FlagResolutionModal.jsx';

export default function StarterPage() {
  const { classId, lessonOrder } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);
  const currentLessonOrder = Number(lessonOrder);

  const teachers = getTeachers();
  const teacher = teachers.find(t => t.class_id === decodedClassId);

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
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {showResolution && (
        <FlagResolutionModal
          question={flagQueue[currentFlagIdx]}
          onFineNow={handleFineNow}
          onRevisit={handleRevisit}
        />
      )}

      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <span className="font-bold text-blue-400 text-lg">{decodedClassId}</span>
          <span className="text-gray-500 text-sm">Lesson {currentLessonOrder}</span>
        </div>
        <div className="flex items-center gap-4">
          <Timer />
          <button
            onClick={handleEndSession}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
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
          <div className="col-span-2 text-center py-20 text-gray-500">
            <p className="text-xl">No questions available yet.</p>
            <p className="text-sm mt-2">Start a lesson to build up the question bank.</p>
          </div>
        )}
      </main>
    </div>
  );
}
