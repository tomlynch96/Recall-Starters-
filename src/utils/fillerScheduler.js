import { getActiveQuestions } from './storage.js';

/**
 * Generate 6 questions for a filler session.
 * Draws only from lessons the teacher has actually taught this class
 * (`deliveredMap`: lesson_id → index taught at). Overdue questions are
 * prioritised — filler lessons are the pressure valve for the
 * spaced-repetition backlog — and any remaining slots are filled randomly
 * from the rest of the taught pool. `now` is the teacher's next lesson index.
 * Fillers never advance the lesson schedule.
 */
export function generateFillerQuestions(classId, deliveredMap, now, questionLog) {
  if (Object.keys(deliveredMap).length === 0) return [];

  const logMap = {};
  for (const entry of questionLog) {
    if (entry.class_id === classId) {
      logMap[entry.question_id] = entry;
    }
  }

  const pool = getActiveQuestions()
    .filter(q => deliveredMap[q.lesson_id] !== undefined)
    .map(q => {
      const entry = logMap[q.id];
      return {
        ...q,
        times_seen: entry ? entry.times_seen : 0,
        last_seen_lesson: entry ? entry.last_seen_lesson : null,
        next_due_lesson: entry ? entry.next_due_lesson : 0,
        flagged: entry ? entry.flagged : false,
        flag_resolved: entry ? entry.flag_resolved : false,
        lesson_order: deliveredMap[q.lesson_id],
      };
    });

  const TARGET = 6;

  // Backlog first: overdue questions ranked by how overdue they are (with
  // jitter so equally-overdue questions vary between fillers)
  const overdue = pool
    .filter(q => q.next_due_lesson <= now)
    .map(q => ({ q, score: (now - q.next_due_lesson) + Math.random() * 3 }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.q);

  const picks = overdue.slice(0, TARGET);

  // Top up randomly from the rest of the taught pool if the backlog is small
  if (picks.length < TARGET) {
    const pickedIds = new Set(picks.map(q => q.id));
    const rest = pool.filter(q => !pickedIds.has(q.id)).sort(() => Math.random() - 0.5);
    picks.push(...rest.slice(0, TARGET - picks.length));
  }

  return picks;
}
