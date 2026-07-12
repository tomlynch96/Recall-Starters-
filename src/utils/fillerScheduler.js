import { getActiveQuestions } from './storage.js';
import { getRotaMap } from './scheduler.js';

/**
 * Generate 6 questions for a filler session.
 * Draws from ALL questions whose lesson_order < the highest lesson_order the
 * teacher has already taught for this class. Overdue questions (due on or
 * before that lesson) are prioritised — filler lessons are the pressure valve
 * for the spaced-repetition backlog. Any remaining slots are filled randomly
 * from the rest of the taught pool.
 * Filler sessions in the session log have lesson_order = -1 and are excluded
 * from the max calculation.
 */
export function generateFillerQuestions(classId, rotaId, questionLog, sessionLog) {
  // Find highest lesson_order taught (excluding filler sessions)
  const classSessions = sessionLog.filter(
    s => s.class_id === classId && s.lesson_order !== -1
  );
  if (classSessions.length === 0) return [];

  const maxLessonOrder = Math.max(...classSessions.map(s => s.lesson_order));

  const rotaMap = getRotaMap(rotaId);
  const logMap = {};
  for (const entry of questionLog) {
    if (entry.class_id === classId) {
      logMap[entry.question_id] = entry;
    }
  }

  // All questions from lessons already taught (lesson_order < maxLessonOrder)
  const pool = getActiveQuestions()
    .filter(q => {
      const lo = rotaMap[q.lesson_id];
      return lo !== undefined && lo < maxLessonOrder;
    })
    .map(q => {
      const entry = logMap[q.id];
      return {
        ...q,
        times_seen: entry ? entry.times_seen : 0,
        last_seen_lesson: entry ? entry.last_seen_lesson : null,
        next_due_lesson: entry ? entry.next_due_lesson : 0,
        flagged: entry ? entry.flagged : false,
        flag_resolved: entry ? entry.flag_resolved : false,
        lesson_order: rotaMap[q.lesson_id] ?? 0,
      };
    });

  const TARGET = 6;

  // Backlog first: overdue questions ranked by how overdue they are (with
  // jitter so equally-overdue questions vary between fillers)
  const overdue = pool
    .filter(q => q.next_due_lesson <= maxLessonOrder)
    .map(q => ({ q, score: (maxLessonOrder - q.next_due_lesson) + Math.random() * 3 }))
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
