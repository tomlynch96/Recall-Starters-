import { ROTAS } from '../data/staticData.js';
import { getActiveQuestions } from './storage.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calculateNextDue(timesSeenAfterSession, currentLessonOrder) {
  if (timesSeenAfterSession === 1) return currentLessonOrder + 1;
  if (timesSeenAfterSession === 2) return currentLessonOrder + randInt(3, 5);
  if (timesSeenAfterSession === 3) return currentLessonOrder + randInt(10, 15);
  return currentLessonOrder + randInt(38, 42);
}

// Get all rota entries for a given rota_id, keyed by lesson_id → lesson_order
export function getRotaMap(rotaId) {
  const map = {};
  for (const r of ROTAS) {
    if (r.rota_id === rotaId) {
      map[r.lesson_id] = r.lesson_order;
    }
  }
  return map;
}

export function getEligibleQuestions(classId, currentLessonOrder, rotaId, questionLog) {
  const rotaMap = getRotaMap(rotaId);
  const logMap = {};
  for (const entry of questionLog) {
    if (entry.class_id === classId) {
      logMap[entry.question_id] = entry;
    }
  }

  return getActiveQuestions().filter(q => {
    const entry = logMap[q.id];
    // Flagged questions always surface for all co-teachers of the class,
    // regardless of which teacher's rota originally contained the question.
    if (entry && entry.flagged) return true;

    const lessonOrder = rotaMap[q.lesson_id];
    if (lessonOrder === undefined) return false;
    if (lessonOrder >= currentLessonOrder) return false;

    if (!entry) return true; // unseen
    return entry.next_due_lesson <= currentLessonOrder;
  }).map(q => {
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
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// Weighted pick favouring the most overdue / least-practised questions.
// Overdue-ness dominates, with random jitter so equally-due questions vary
// between sessions. Never-seen questions score highest (next_due 0).
function pickPrioritised(arr, n, currentLessonOrder) {
  return [...arr]
    .map(q => ({
      q,
      score: (currentLessonOrder - (q.next_due_lesson ?? 0)) + Math.random() * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.q);
}

export function generateStarterQuestions(classId, currentLessonOrder, rotaId, questionLog, target = 6) {
  const eligible = getEligibleQuestions(classId, currentLessonOrder, rotaId, questionLog);

  // Flagged questions always appear first
  const flagged = eligible.filter(q => q.flagged);

  // Slots partition ALL past lessons contiguously so every due question has a
  // route back into a starter, matching the repetition intervals in
  // calculateNextDue (1 / 3-5 / 10-15 / 38-42):
  //   A: last lesson            (1st repetition)          ×2
  //   B: 2 lessons ago          (catch-up on 1st rep)     ×1
  //   C: 3-5 lessons ago        (2nd repetition)          ×1
  //   D: 6-15 lessons ago       (3rd repetition)          ×1
  //   E: 16+ lessons ago        (4th+ repetition)         ×1
  const lastLesson = currentLessonOrder - 1;
  const slotA = eligible.filter(q => !q.flagged && q.lesson_order === lastLesson);
  const slotB = eligible.filter(q => !q.flagged && q.lesson_order === currentLessonOrder - 2);
  const slotC = eligible.filter(q => !q.flagged && q.lesson_order >= currentLessonOrder - 5 && q.lesson_order <= currentLessonOrder - 3);
  const slotD = eligible.filter(q => !q.flagged && q.lesson_order >= currentLessonOrder - 15 && q.lesson_order <= currentLessonOrder - 6);
  const slotE = eligible.filter(q => !q.flagged && q.lesson_order <= currentLessonOrder - 16);

  // Slot quotas cover 6 questions; anything above (e.g. the 8-question
  // starter) is filled from the most-overdue eligible via the final fallback,
  // so the extra capacity works down the spaced-repetition backlog.
  const TARGET = target;
  const selected = [...flagged];

  const slots = [
    { pool: slotA, target: 2 },
    { pool: slotB, target: 1 },
    { pool: slotC, target: 1 },
    { pool: slotD, target: 1 },
    { pool: slotE, target: 1 },
  ];

  let unfilled = 0;
  const picks = [];

  for (const slot of slots) {
    if (selected.length + picks.length >= TARGET) break;
    const remaining = TARGET - selected.length - picks.length;
    const want = Math.min(slot.target + unfilled, remaining);
    const available = slot.pool.filter(q => !selected.find(s => s.id === q.id) && !picks.find(p => p.id === q.id));
    const got = pickPrioritised(available, want, currentLessonOrder);
    picks.push(...got);
    unfilled = want - got.length;
  }

  // If short (e.g. 8-question starter, or thin slots), fill with the most
  // overdue eligible questions — extra capacity works down the backlog
  if (selected.length + picks.length < TARGET) {
    const alreadyIds = new Set([...selected, ...picks].map(q => q.id));
    const fallback = eligible.filter(q => !alreadyIds.has(q.id));
    const need = TARGET - selected.length - picks.length;
    picks.push(...pickPrioritised(fallback, need, currentLessonOrder));
  }

  // Ultimate fallback: ignore SR schedule, draw from ALL previously taught questions
  // This handles the case where all taught questions have been seen but aren't due yet
  if (selected.length + picks.length < TARGET) {
    const alreadyIds = new Set([...selected, ...picks].map(q => q.id));
    const rotaMap = getRotaMap(rotaId);
    const logMap2 = {};
    for (const entry of questionLog) {
      if (entry.class_id === classId) logMap2[entry.question_id] = entry;
    }
    const allTaught = getActiveQuestions()
      .filter(q => {
        const lo = rotaMap[q.lesson_id];
        return lo !== undefined && lo < currentLessonOrder && !alreadyIds.has(q.id);
      })
      .map(q => {
        const entry = logMap2[q.id];
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
    const need = TARGET - selected.length - picks.length;
    picks.push(...pickRandom(allTaught, need));
  }

  return [...selected, ...picks].slice(0, TARGET);
}

export function updateQuestionLog(classId, shownQuestions, currentLessonOrder, existingLog) {
  const log = [...existingLog];
  const now = new Date().toISOString();

  for (const q of shownQuestions) {
    const idx = log.findIndex(e => e.class_id === classId && e.question_id === q.id);
    const timesSeen = (idx >= 0 ? log[idx].times_seen : 0) + 1;
    const nextDue = calculateNextDue(timesSeen, currentLessonOrder);

    if (idx >= 0) {
      const isFlagged = log[idx].flagged;
      log[idx] = {
        ...log[idx],
        times_seen: timesSeen,
        last_seen_lesson: currentLessonOrder,
        // If still flagged, keep next_due at current+1; otherwise use normal schedule
        next_due_lesson: isFlagged ? currentLessonOrder + 1 : nextDue,
        updated_at: now,
      };
    } else {
      log.push({
        class_id: classId,
        question_id: q.id,
        times_seen: timesSeen,
        last_seen_lesson: currentLessonOrder,
        next_due_lesson: nextDue,
        flagged: q.flagged || false,
        flag_resolved: false,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return log;
}
