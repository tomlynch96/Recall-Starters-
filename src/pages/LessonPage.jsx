import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, saveSessionLog } from '../utils/storage.js';
import { ROTAS, LESSONS } from '../data/staticData.js';
import { generateUUID } from '../utils/uuid.js';

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

  if (!teacher) {
    navigate('/');
    return null;
  }

  const rotaLessons = getRotaLessons(teacher.rota_id);
  const sessionLog = getSessionLog();
  const classSessions = sessionLog.filter(s => s.class_id === decodedClassId);
  classSessions.sort((a, b) => b.lesson_order - a.lesson_order);

  const lastCompletedOrder = classSessions.length > 0 ? classSessions[0].lesson_order : 0;
  const defaultIdx = Math.min(
    rotaLessons.findIndex(r => r.lesson_order > lastCompletedOrder),
    rotaLessons.length - 1
  );
  const startIdx = defaultIdx === -1 ? rotaLessons.length - 1 : defaultIdx;

  const [idx, setIdx] = useState(startIdx);
  const selectedRota = rotaLessons[idx];

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
    saveSessionLog([...getSessionLog(), entry]);
    navigate(`/starter/${encodeURIComponent(decodedClassId)}/${selectedRota.lesson_order}`);
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
        <span className="text-gray-400 text-sm">{teacher.rota_id}</span>
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
