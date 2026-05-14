import { useState } from 'react';

export default function TopicAccordion({ topicName, lessons, questionLog, classId, maxLessonOrder }) {
  const [open, setOpen] = useState(false);

  const logMap = {};
  for (const e of questionLog) {
    if (e.class_id === classId) logMap[e.question_id] = e;
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-semibold text-gray-800">{topicName}</span>
        <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {lessons.map(lesson => (
            <LessonSection
              key={lesson.lesson_id}
              lesson={lesson}
              logMap={logMap}
              maxLessonOrder={maxLessonOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonSection({ lesson, logMap, maxLessonOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 bg-white hover:bg-gray-50 text-left"
      >
        <span className="text-sm font-medium text-gray-700">
          {lesson.lesson_number !== 'Assessment' ? `L${lesson.lesson_number}: ` : ''}
          {lesson.lesson_title}
        </span>
        <span className="text-gray-300 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2">
          {lesson.questions.map(q => {
            const entry = logMap[q.id];
            return (
              <div key={q.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 flex-1 truncate">{q.question}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry?.flagged && <span title="Flagged">🚩</span>}
                    {!entry?.flagged && entry?.flag_resolved && <span title="Previously flagged" className="opacity-30">🚩</span>}
                    {entry && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        ×{entry.times_seen}
                      </span>
                    )}
                  </div>
                </div>
                {entry && (
                  <div className="mt-1 flex gap-4 text-xs text-gray-400">
                    <span>Last seen: L{entry.last_seen_lesson}</span>
                    <span>Next due: L{entry.next_due_lesson}</span>
                  </div>
                )}
                {entry && maxLessonOrder > 0 && (
                  <TimelineDots entry={entry} max={maxLessonOrder} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TimelineDots({ entry, max }) {
  const dots = [];
  for (let i = 1; i <= Math.min(max, 60); i++) {
    const seen = entry.last_seen_lesson === i;
    const due = entry.next_due_lesson === i;
    dots.push(
      <div
        key={i}
        title={seen ? `Seen L${i}` : due ? `Due L${i}` : `L${i}`}
        className={`h-2 rounded-full ${
          seen ? 'bg-blue-500 w-3' : due ? 'bg-amber-400 w-2' : 'bg-gray-200 w-1.5'
        }`}
      />
    );
  }
  return <div className="flex items-center gap-0.5 mt-2 flex-wrap">{dots}</div>;
}
