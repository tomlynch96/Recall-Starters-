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
  if (!rotaOrderMap || !rotaOrderMap[order]) return `#${order}`;
  const { lesson_number, lesson_title } = rotaOrderMap[order];
  const num = lesson_number && lesson_number !== 'Assessment' ? `L${lesson_number}` : 'Assessment';
  return `${num} — ${lesson_title}`;
}

// Midpoint intervals: index = times_seen AFTER the visit
const INTERVALS = [0, 1, 4, 12, 40];

function projectFutureVisits(entry, maxLessonOrder) {
  const visits = [];
  let order = entry.next_due_lesson;
  let seen = entry.times_seen;
  while (order <= maxLessonOrder && visits.length < 12) {
    visits.push(order);
    seen++;
    const interval = seen >= INTERVALS.length ? INTERVALS[INTERVALS.length - 1] : INTERVALS[seen];
    order += interval;
  }
  return visits;
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
            const futureVisits = entry ? projectFutureVisits(entry, maxLessonOrder) : [];
            const lastLabel = entry ? lessonLabel(entry.last_seen_lesson, rotaOrderMap) : null;

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

                {/* Full schedule chain */}
                {entry ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Last seen */}
                    <div className="flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs">
                      <span className="opacity-60">last:</span>
                      <span className="font-medium">{lastLabel}</span>
                    </div>

                    {futureVisits.length > 0 && <span className="text-gray-300 text-xs">→</span>}

                    {futureVisits.map((order, i) => (
                      <div key={order} className="flex items-center gap-2">
                        <div className={`flex items-baseline gap-1 px-2.5 py-1 rounded-lg text-xs ${
                          i === 0
                            ? entry.flagged
                              ? 'bg-amber-100 text-amber-700 font-semibold ring-1 ring-amber-300'
                              : 'bg-green-100 text-green-700 font-semibold ring-1 ring-green-300'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {i === 0 && <span className="opacity-60 mr-1">next:</span>}
                          <span>{lessonLabel(order, rotaOrderMap)}</span>
                        </div>
                        {i < futureVisits.length - 1 && (
                          <span className="text-gray-300 text-xs">→</span>
                        )}
                      </div>
                    ))}

                    {futureVisits.length === 0 && (
                      <span className="text-xs text-gray-400 italic">no further visits within this rota</span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Will appear once this lesson has been taught</span>
                )}

                {/* Timeline */}
                {entry && maxLessonOrder > 0 && (
                  <TimelineDots
                    lastSeen={entry.last_seen_lesson}
                    futureVisits={futureVisits}
                    max={maxLessonOrder}
                    rotaOrderMap={rotaOrderMap}
                  />
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

function TimelineDots({ lastSeen, futureVisits, max, rotaOrderMap }) {
  const futureSet = new Set(futureVisits);
  const nextVisit = futureVisits[0];
  const dots = [];
  for (let i = 1; i <= Math.min(max, 80); i++) {
    const isLast = lastSeen === i;
    const isNext = nextVisit === i;
    const isFuture = !isNext && futureSet.has(i);
    const label = lessonLabel(i, rotaOrderMap);
    const title = isLast
      ? `Last seen: ${label}`
      : isNext
      ? `Next due: ${label}`
      : isFuture
      ? `Scheduled: ${label}`
      : label;
    dots.push(
      <div
        key={i}
        title={title}
        className={`h-2 rounded-full flex-shrink-0 transition-colors ${
          isLast  ? 'bg-blue-500 w-3' :
          isNext  ? 'bg-green-500 w-3' :
          isFuture ? 'bg-green-300 w-2' :
          'bg-gray-200 w-1.5'
        }`}
      />
    );
  }
  return <div className="flex items-center gap-0.5 mt-3 flex-wrap">{dots}</div>;
}
