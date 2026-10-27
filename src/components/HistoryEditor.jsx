import { useState, useMemo } from 'react';
import { getRotaSequence, getMySchedule, inferHistoryFor, confirmHistory } from '../utils/schedule.js';
import { topicColour, getLessonMeta, lessonLabel } from '../utils/topicColours.js';

function formatDay(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
}

// Tick which lessons have been taught. Used once for reboarding (prefilled
// from old session history) and later to correct the lesson history.
export default function HistoryEditor({ classId, email, rotaId, mode, onDone, onCancel }) {
  const seq = useMemo(() => getRotaSequence(rotaId), [rotaId]);
  const inferred = useMemo(() => (mode === 'reboard' ? inferHistoryFor(classId, email) : null), [classId, email, mode]);
  const scheduleDates = useMemo(
    () => Object.fromEntries(getMySchedule(classId, email).map(e => [e.lesson_id, e.taught_at])),
    [classId, email],
  );
  const dateOf = id => scheduleDates[id] || inferred?.dateByLesson[id] || null;

  const [checked, setChecked] = useState(() => new Set(
    mode === 'reboard' ? inferred.lessonIds : getMySchedule(classId, email).map(e => e.lesson_id),
  ));

  function toggle(id) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // "Taught up to here": everything up to and including this lesson, nothing after
  function upToHere(i) {
    setChecked(new Set(seq.slice(0, i + 1)));
  }

  const taughtCount = seq.filter(id => checked.has(id)).length;
  const nextLessonId = seq.find(id => !checked.has(id));
  const lastTicked = [...seq].reverse().find(id => checked.has(id));

  function confirm() {
    confirmHistory(classId, email, [...checked], inferred?.dateByLesson || {});
    onDone();
  }

  return (
    <div className="bg-white border-2 border-amber-300 rounded-2xl p-5">
      {mode === 'reboard' ? (
        <>
          <h2 className="text-lg font-bold text-gray-800">Check your lesson history</h2>
          <p className="text-sm text-gray-600 mt-1">
            Recall starters now only use lessons you've actually taught. From your past starters we think this class is up to{' '}
            <strong>{lastTicked ? lessonLabel(lastTicked) : 'the start'}</strong>
            {' '}({inferred.daysCount} day{inferred.daysCount === 1 ? '' : 's'} with a starter).
          </p>
          {inferred.furthestLessonId && inferred.furthestLessonId !== lastTicked && (
            <p className="text-xs text-gray-500 mt-1">
              You also opened lessons up to {lessonLabel(inferred.furthestLessonId)}. Lessons you only looked at aren't counted.
            </p>
          )}
          {inferred.offPace && (
            <p className="text-xs text-amber-700 mt-1">
              That's {taughtCount > inferred.expected ? 'more' : 'fewer'} than we'd expect for your rota so far (about {inferred.expected}) — worth double-checking.
            </p>
          )}
          <p className="text-sm text-gray-600 mt-2">Tick every lesson you've taught, then confirm. You can't teach this class until it's confirmed.</p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold text-gray-800">Edit lesson history</h2>
          <p className="text-sm text-gray-600 mt-1">
            Tick the lessons you've taught. Unticking a lesson removes its questions from your recall starters.
          </p>
        </>
      )}

      <div className="mt-4 max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl">
        {seq.map((id, i) => {
          const meta = getLessonMeta(id);
          const topic = meta?.topic_name || 'Unknown';
          const showTopic = i === 0 || getLessonMeta(seq[i - 1])?.topic_name !== topic;
          const isChecked = checked.has(id);
          return (
            <div key={id}>
              {showTopic && (
                <div className="flex items-center gap-2 px-3 pt-3 pb-1 bg-white sticky top-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${topicColour(topic).dot}`} />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{topic}</span>
                </div>
              )}
              <div className={`group flex items-center gap-3 px-3 py-1.5 ${isChecked ? 'bg-green-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(id)}
                  className="accent-green-600 w-4 h-4"
                />
                <span className={`flex-1 text-sm ${isChecked ? 'text-gray-800' : 'text-gray-400'}`}>{lessonLabel(id)}</span>
                {isChecked && dateOf(id) && <span className="text-xs text-gray-400">{formatDay(dateOf(id))}</span>}
                <button
                  onClick={() => upToHere(i)}
                  className="text-xs text-blue-600 hover:text-blue-800 opacity-0 group-hover:opacity-100 whitespace-nowrap"
                  title="Tick every lesson up to here and untick the rest"
                >
                  taught up to here
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600">
          <strong>{taughtCount}</strong> taught · next: <strong>{nextLessonId ? lessonLabel(nextLessonId) : 'end of rota'}</strong>
        </p>
        <div className="flex gap-2">
          {onCancel && (
            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          )}
          <button onClick={confirm} className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700">
            {mode === 'reboard' ? 'Confirm — this is right' : 'Save history'}
          </button>
        </div>
      </div>
    </div>
  );
}
