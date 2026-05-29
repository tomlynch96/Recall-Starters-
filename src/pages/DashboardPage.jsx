import { useNavigate, useParams, Link } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getQuestionLog } from '../utils/storage.js';
import { QUESTIONS, LESSONS, ROTAS } from '../data/staticData.js';
import TopicAccordion from '../components/TopicAccordion.jsx';

export default function DashboardPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const decodedClassId = decodeURIComponent(classId);

  const teachers = getTeachers();
  const email = getCurrentTeacher();
  const teacher = teachers.find(t => t.class_id === decodedClassId && t.email === email);
  if (!teacher) { navigate('/'); return null; }

  const questionLog = getQuestionLog();
  const classLog = questionLog.filter(e => e.class_id === decodedClassId);

  const rotaEntries = ROTAS.filter(r => r.rota_id === teacher.rota_id);
  const rotaLessonIds = new Set(rotaEntries.map(r => r.lesson_id));
  const maxLessonOrder = Math.max(0, ...rotaEntries.map(r => r.lesson_order));

  // Map lesson_order → { lesson_id, lesson_title, lesson_number }
  const rotaOrderMap = {};
  // Map lesson_id → lesson_order (for projecting unseen questions)
  const lessonIdToOrder = {};
  for (const r of rotaEntries) {
    const lesson = LESSONS.find(l => l.lesson_id === r.lesson_id);
    rotaOrderMap[r.lesson_order] = lesson
      ? { lesson_id: r.lesson_id, lesson_title: lesson.lesson_title, lesson_number: lesson.lesson_number }
      : { lesson_id: r.lesson_id, lesson_title: r.lesson_id, lesson_number: String(r.lesson_order) };
    lessonIdToOrder[r.lesson_id] = r.lesson_order;
  }

  const rotaQuestions = QUESTIONS.filter(q => rotaLessonIds.has(q.lesson_id));
  const totalSeen = classLog.filter(e => e.times_seen > 0).length;
  const totalFlagged = classLog.filter(e => e.flagged).length;

  // Group by topic → lesson
  const topicMap = new Map();
  for (const q of rotaQuestions) {
    if (!topicMap.has(q.topic_name)) topicMap.set(q.topic_name, new Map());
    const lessonMap = topicMap.get(q.topic_name);
    if (!lessonMap.has(q.lesson_id)) {
      const lesson = LESSONS.find(l => l.lesson_id === q.lesson_id);
      lessonMap.set(q.lesson_id, { ...lesson, questions: [] });
    }
    lessonMap.get(q.lesson_id).questions.push(q);
  }

  const topics = Array.from(topicMap.entries()).map(([name, lessonMap]) => ({
    topicName: name,
    lessons: Array.from(lessonMap.values()).sort((a, b) =>
      Number(a.lesson_number) - Number(b.lesson_number)
    ),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to={`/lesson/${encodeURIComponent(decodedClassId)}`} className="text-blue-600 hover:underline text-sm">
          ← Back
        </Link>
        <h1 className="text-xl font-bold text-blue-800">{decodedClassId} — Dashboard</h1>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
            <div className="text-3xl font-bold text-blue-700">{rotaQuestions.length}</div>
            <div className="text-sm text-gray-500 mt-1">Total questions</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
            <div className="text-3xl font-bold text-green-600">{totalSeen}</div>
            <div className="text-sm text-gray-500 mt-1">Seen at least once</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-gray-200">
            <div className="text-3xl font-bold text-amber-500">{totalFlagged}</div>
            <div className="text-sm text-gray-500 mt-1">Currently flagged</div>
          </div>
        </div>

        <div>
          {topics.map(t => (
            <TopicAccordion
              key={t.topicName}
              topicName={t.topicName}
              lessons={t.lessons}
              questionLog={questionLog}
              classId={decodedClassId}
              maxLessonOrder={maxLessonOrder}
              rotaOrderMap={rotaOrderMap}
              lessonIdToOrder={lessonIdToOrder}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
