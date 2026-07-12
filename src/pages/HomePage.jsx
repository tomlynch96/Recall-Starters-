import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getSessionLog, updateHoDFlag, unenrollTeacher, appendSession } from '../utils/storage.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ROTAS, LESSONS } from '../data/staticData.js';
import { generateUUID } from '../utils/uuid.js';
import BrainBuddy, { getBrainStage } from '../components/BrainBuddy.jsx';

const SCIENCE_JOKES = [
  "Why can't you trust an atom? Because they make up everything!",
  'A neutron walks into a bar and asks how much a drink costs. The barman says: "For you? No charge."',
  "Why did the white blood cell get detention? It kept attacking everything in cell-f defence.",
  "I told a chemistry joke once. There was no reaction.",
  "Why are chemists great at solving problems? They have all the solutions.",
  "What did the biologist wear on their first date? Designer genes.",
  "Why did the physics teacher break up with the biology teacher? There was no chemistry.",
  "How do you organise a space party? You planet.",
  "What do you call an acid with an attitude? A-mean-oh acid!",
  "Why can't plants do maths? Because square roots confuse them.",
  "Sodium said hello. I said 'Na, not today.'",
  "The photon checked into a hotel with no luggage. It was travelling light.",
  "What did one tectonic plate say to the other? Sorry, my fault!",
  "Why is electricity the model student? It conducts itself perfectly.",
  "Never trust gravity — it always lets you down.",
  "What's a physicist's favourite food? Fission chips.",
  "Oxygen and potassium went on a date. It was OK.",
  "Why did the germ cross the microscope? To get to the other slide.",
  "I was reading a book about helium. I couldn't put it down.",
  "Bacteria: the only culture some people have.",
];

function getRotaName(rotaId) {
  const entry = ROTAS.find(r => r.rota_id === rotaId);
  return entry ? entry.rota_name : rotaId;
}

function getFirstName(email) {
  if (!email) return 'there';
  const raw = email.split('@')[0].split(/[._-]/)[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getLastSession(classId, sessionLog) {
  const sessions = sessionLog.filter(s => s.class_id === classId);
  if (!sessions.length) return null;
  sessions.sort((a, b) => new Date(b.opened_at) - new Date(a.opened_at));
  return sessions[0].opened_at;
}

// Next lesson for this teacher+class: first rota entry after the last completed one
function getNextLesson(classId, rotaId, email, sessionLog) {
  const rotaLessons = ROTAS.filter(r => r.rota_id === rotaId).sort((a, b) => a.lesson_order - b.lesson_order);
  if (rotaLessons.length === 0) return null;
  const mySessions = sessionLog.filter(s => s.class_id === classId && s.teacher_email === email && s.lesson_order !== -1);
  const lastCompleted = mySessions.length > 0 ? Math.max(...mySessions.map(s => s.lesson_order)) : 0;
  const next = rotaLessons.find(r => r.lesson_order > lastCompleted) || rotaLessons[rotaLessons.length - 1];
  const lesson = LESSONS.find(l => l.lesson_id === next.lesson_id);
  return {
    ...next,
    lesson_title: lesson?.lesson_title || next.lesson_id,
    lesson_number: lesson?.lesson_number || '',
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const email = getCurrentTeacher();
  const [teachers, setTeachers] = useState(() => getTeachers());
  const sessionLog = getSessionLog();

  // Rotate the science joke every 12 seconds
  const [jokeIdx, setJokeIdx] = useState(() => Math.floor(Math.random() * SCIENCE_JOKES.length));
  useEffect(() => {
    const t = setInterval(() => setJokeIdx(i => (i + 1) % SCIENCE_JOKES.length), 12000);
    return () => clearInterval(t);
  }, []);

  if (!email) {
    navigate('/login');
    return null;
  }

  const mySessionCount = sessionLog.filter(s => s.teacher_email === email).length;
  const brainStage = getBrainStage(mySessionCount);

  const classSet = new Map();
  for (const t of teachers) {
    if (t.class_id && !classSet.has(t.class_id)) {
      classSet.set(t.class_id, t);
    }
  }
  const classes = Array.from(classSet.values()).filter(t =>
    teachers.some(t2 => t2.email === email && t2.class_id === t.class_id)
  );

  const isHoD = teachers.some(t => t.email === email && t.is_hod);
  const existingHoD = teachers.find(t => t.is_hod && t.email);

  async function logout() {
    await signOut();
    navigate('/login');
  }

  function toggleHoD() {
    updateHoDFlag(email, !isHoD);
    setTeachers(getTeachers());
  }

  // One-click start: log the session, go fullscreen, jump straight into the starter
  function startNextStarter(e, classId, nextLesson) {
    e.stopPropagation();
    document.documentElement.requestFullscreen?.().catch(() => {});
    appendSession({
      id: generateUUID(),
      class_id: classId,
      teacher_email: email,
      lesson_order: nextLesson.lesson_order,
      lesson_id: nextLesson.lesson_id,
      opened_at: new Date().toISOString(),
    });
    navigate(`/starter/${encodeURIComponent(classId)}/${nextLesson.lesson_order}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-800">Recall Starter</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">{email}</span>

          {/* Only show HoD toggle to: the current HoD, or anyone if no HoD exists yet */}
          {(isHoD || !existingHoD) ? (
            <button
              onClick={toggleHoD}
              title={isHoD ? 'Click to leave HoD mode' : 'Click to enable HoD mode'}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                isHoD
                  ? 'bg-blue-700 text-white border-blue-700 hover:bg-blue-800'
                  : 'text-gray-400 border-gray-200 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {isHoD ? 'HoD ✓' : 'HoD'}
            </button>
          ) : (
            <span className="text-xs text-gray-400 px-3 py-1 rounded-full border border-gray-100">
              HoD: {existingHoD.email.split('@')[0]}
            </span>
          )}

          <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700 underline">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Welcome banner with brain buddy + rotating science joke */}
        <section className="mb-8 bg-white border border-gray-200 rounded-2xl px-8 py-6 flex items-center gap-8">
          <BrainBuddy sessions={mySessionCount} />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome back, {getFirstName(email)}! 👋
            </h2>
            <p key={jokeIdx} className="text-gray-500 italic mt-2 animate-[fadeIn_0.6s_ease]">
              {SCIENCE_JOKES[jokeIdx]}
            </p>
            <p className="text-xs text-gray-400 mt-3">
              {mySessionCount === 0
                ? 'Run your first starter to start growing your brain buddy!'
                : `${mySessionCount} starter${mySessionCount === 1 ? '' : 's'} run — your brain buddy is ${brainStage.label}!`}
            </p>
          </div>
        </section>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-700">Your classes</h2>
          <button
            onClick={() => navigate('/setup')}
            className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
          >
            + Add class
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-2">No classes set up yet.</p>
            <p className="text-gray-400 text-sm">Use the button above to join a class.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(t => {
              const lastSession = getLastSession(t.class_id, sessionLog);
              const mine = teachers.find(t2 => t2.email === email && t2.class_id === t.class_id) || t;
              const nextLesson = getNextLesson(t.class_id, mine.rota_id, email, sessionLog);
              return (
                <div key={t.class_id} className="group relative">
                  <button
                    onClick={() => navigate(`/lesson/${encodeURIComponent(t.class_id)}`)}
                    className="w-full bg-white border-2 border-gray-200 rounded-2xl p-6 text-left hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="text-2xl font-bold text-blue-800 mb-1">{t.class_id}</div>
                    <div className="text-sm text-gray-500 mb-3">{getRotaName(mine.rota_id)}</div>
                    {nextLesson && (
                      <div className="text-sm text-gray-600 font-medium mb-2">
                        Next: {nextLesson.lesson_number === 'Assessment' ? 'Assessment' : `L${nextLesson.lesson_number}`} — {nextLesson.lesson_title}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {lastSession
                        ? `Last session: ${new Date(lastSession).toLocaleDateString()}`
                        : 'No sessions yet'}
                    </div>
                  </button>

                  {/* One-click start for the next lesson */}
                  {nextLesson && (
                    <button
                      onClick={e => startNextStarter(e, t.class_id, nextLesson)}
                      title={`Start starter: ${nextLesson.lesson_title}`}
                      className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-blue-700 text-white shadow-md hover:bg-blue-800 hover:scale-105 transition-all flex items-center justify-center text-lg"
                    >
                      ▶
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (!window.confirm(`Remove ${t.class_id} from your homepage? Your session history for this class is kept.`)) return;
                      unenrollTeacher(email, t.class_id);
                      setTeachers(getTeachers());
                    }}
                    title="Remove class"
                    className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {isHoD && (
        <div className="max-w-4xl mx-auto px-6 pb-10">
          <button
            onClick={() => navigate('/hod')}
            className="w-full py-4 border-2 border-dashed border-blue-200 rounded-2xl text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors font-medium"
          >
            Open HoD Dashboard — all classes overview →
          </button>
        </div>
      )}
    </div>
  );
}
