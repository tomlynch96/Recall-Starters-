import { useState } from 'react';

export default function TopicAccordion({ topicName, lessons, questionLog, classId, maxLessonOrder, rotaOrderMap }) {
  const [open, setOpen] = useState(false);

  const logMap = {};
  for (const e of questionLog) {
    if (e.class_id === classId) logMap[e.question_id] = e;
  }

  const totalQs = lessons.reduce((n, l) => n + l.questions.length, 0);
  const seenQs = lessons.reduce((n, l) =>
    n + l.questions.filter(q => logMap[q.id]?.times_seen > 0).length, 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 text-left"
      >
        <span className="font-semibold text-gray-800">{topicName}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{seenQs}/{totalQs} seen</span>
          <span className="text-gray-400 text-lg">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {lessons.map(lesson => (
            <LessonSection
              key={lesson.lesson_id}
              lesson={lesson}
              logMap={logMap}
              maxLessonOrder={maxLessonOrder}
              rotaOrderMap={rotaOrderMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function lessonLabel(order, rotaOrderMap) {
  if (!rotaOrderMap || !rotaOrderMap[order]) return `lesson ${order}`;
  const { lesson_number, lesson_title } = rotaOrderMap[order];
  const num = lesson_number && lesson_number !== 'Assessment' ? `L${lesson_number}` : 'Assessment';
  return `${num} — ${lesson_title}`;
}

function LessonSection({ lesson, logMap, maxLessonOrder, rotaOrderMap }) {
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
        <div className="px-5 pb-4 space-y-3">
          {lesson.questions.map(q => {
            const entry = logMap[q.id];
            const nextLabel = entry ? lessonLabel(entry.next_due_lesson, rotaOrderMap) : null;
            const lastLabel = entry ? lessonLabel(entry.last_seen_lesson, rotaOrderMap) : null;
            const isOverdue = entry && entry.next_due_lesson <= (entry.last_seen_lesson ?? 0);

            return (
              <div key={q.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                {/* Question text + badges */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <p className="text-sm text-gray-800 flex-1 leading-snug">{q.question}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry?.flagged && <span title="Flagged">🚩</span>}
                    {!entry?.flagged && entry?.flag_resolved && (
                      <span title="Previously flagged" className="opacity-30">🚩</span>
                    )}
                    {entry ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        seen ×{entry.times_seen}
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                        not seen
                      </span>
                    )}
                  </div>
                </div>

                {/* Schedule row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {entry ? (
                    <>
                      <SchedulePill
                        label="Last seen"
                        value={lastLabel}
                        color="blue"
                      />
                      <span className="text-gray-300 text-xs">→</span>
                      <SchedulePill
                        label="Next due"
                        value={nextLabel}
                        color={entry.flagged ? 'amber' : 'green'}
                        bold
                      />
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Will appear once this lesson has been taught</span>
                  )}
                </div>

                {/* Timeline */}
                {entry && maxLessonOrder > 0 && (
                  <TimelineDots entry={entry} max={maxLessonOrder} rotaOrderMap={rotaOrderMap} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SchedulePill({ label, value, color, bold }) {
  const colours = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`flex items-baseline gap-1.5 px-3 py-1 rounded-lg text-xs ${colours[color]}`}>
      <span className="opacity-60">{label}:</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

function TimelineDots({ entry, max, rotaOrderMap }) {
  const dots = [];
  for (let i = 1; i <= Math.min(max, 80); i++) {
    const seen = entry.last_seen_lesson === i;
    const due = entry.next_due_lesson === i;
    const title = seen
      ? `Last seen: ${lessonLabel(i, rotaOrderMap)}`
      : due
      ? `Next due: ${lessonLabel(i, rotaOrderMap)}`
      : lessonLabel(i, rotaOrderMap);
    dots.push(
      <div
        key={i}
        title={title}
        className={`h-2 rounded-full flex-shrink-0 ${
          seen ? 'bg-blue-500 w-3' : due ? 'bg-green-500 w-3' : 'bg-gray-200 w-1.5'
        }`}
      />
    );
  }
  return <div className="flex items-center gap-0.5 mt-3 flex-wrap">{dots}</div>;
}
