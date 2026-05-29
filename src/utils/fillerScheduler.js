import { QUESTIONS } from '../data/staticData.js';
import { getRotaMap } from './scheduler.js';

/**
 * Generate 6 random questions for a filler session.
 * Draws from ALL questions whose lesson_order < the highest lesson_order
 * the teacher has already taught for this class (ignoring SR schedule).
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
  const pool = QUESTIONS
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

  // Shuffle and take 6
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 6);
}
