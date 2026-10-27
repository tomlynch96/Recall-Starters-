import { useNavigate, useParams, Link } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getQuestionLog, getActiveQuestions } from '../utils/storage.js';
import { getTimeline } from '../utils/schedule.js';
import { LESSONS } from '../data/staticData.js';
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

  // The teacher's lesson clock: lessons actually taught, then the projected
  // upcoming ones (their next choice first, then untaught rota lessons)
  const timeline = getTimeline(decodedClassId, email);
  const rotaLessonIds = new Set(timeline.map(r => r.lesson_id));
  const maxLessonOrder = timeline.length;

  // Map lesson index → { lesson_id, lesson_title, lesson_number }
  const rotaOrderMap = {};
  // Map lesson_id → index it was (last) taught at / is projected for
  const lessonIdToOrder = {};
  for (const r of timeline) {
    const lesson = LESSONS.find(l => l.lesson_id === r.lesson_id);
    rotaOrderMap[r.index] = lesson
      ? { lesson_id: r.lesson_id, lesson_title: lesson.lesson_title, lesson_number: lesson.lesson_number }
      : { lesson_id: r.lesson_id, lesson_title: r.lesson_id, lesson_number: String(r.index) };
    lessonIdToOrder[r.lesson_id] = r.index;
  }

  const rotaQuestions = getActiveQuestions().filter(q => rotaLessonIds.has(q.lesson_id));
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

  // Teaching order: when each topic's first lesson is (or will be) taught
  const topicFirstOrder = new Map();
  for (const r of timeline) {
    const lesson = LESSONS.find(l => l.lesson_id === r.lesson_id);
    const topic = lesson?.topic_name;
    if (topic && (!topicFirstOrder.has(topic) || r.index < topicFirstOrder.get(topic))) {
      topicFirstOrder.set(topic, r.index);
    }
  }

  const topics = Array.from(topicMap.entries())
    .map(([name, lessonMap]) => ({
      topicName: name,
      // Lessons within a topic follow the teaching order
      lessons: Array.from(lessonMap.values()).sort((a, b) =>
        (lessonIdToOrder[a.lesson_id] ?? Infinity) - (lessonIdToOrder[b.lesson_id] ?? Infinity)
      ),
    }))
    // Topics in the order they are taught
    .sort((a, b) =>
      (topicFirstOrder.get(a.topicName) ?? Infinity) - (topicFirstOrder.get(b.topicName) ?? Infinity)
    );

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
          {topics.map((t, i) => (
            <TopicAccordion
              key={t.topicName}
              order={i + 1}
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
