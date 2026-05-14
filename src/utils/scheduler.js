import { QUESTIONS, ROTAS } from '../data/staticData.js';

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

  return QUESTIONS.filter(q => {
    const lessonOrder = rotaMap[q.lesson_id];
    if (lessonOrder === undefined) return false;
    if (lessonOrder >= currentLessonOrder) return false;

    const entry = logMap[q.id];
    if (!entry) return true; // unseen
    if (entry.flagged) return entry.next_due_lesson <= currentLessonOrder;
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
      lesson_order: rotaMap[q.lesson_id],
    };
  });
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function generateStarterQuestions(classId, currentLessonOrder, rotaId, questionLog) {
  const eligible = getEligibleQuestions(classId, currentLessonOrder, rotaId, questionLog);

  // Flagged questions always appear first
  const flagged = eligible.filter(q => q.flagged);

  // Slot definitions by lesson_order distance from current
  const lastLesson = currentLessonOrder - 1;
  const slotA = eligible.filter(q => !q.flagged && q.lesson_order === lastLesson);
  const slotB = eligible.filter(q => !q.flagged && q.lesson_order === currentLessonOrder - 2);
  const slotC = eligible.filter(q => !q.flagged && q.lesson_order >= currentLessonOrder - 5 && q.lesson_order <= currentLessonOrder - 3);
  const slotD = eligible.filter(q => !q.flagged && q.lesson_order >= currentLessonOrder - 15 && q.lesson_order <= currentLessonOrder - 10);
  const slotE = eligible.filter(q => !q.flagged && q.lesson_order <= currentLessonOrder - 38);

  const TARGET = 8;
  const selected = [...flagged];

  const slots = [
    { pool: slotA, target: 4 },
    { pool: slotB, target: 2 },
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
    const got = pickRandom(available, want);
    picks.push(...got);
    unfilled = want - got.length;
  }

  // If still short, fill from slot A
  if (selected.length + picks.length < TARGET) {
    const alreadyIds = new Set([...selected, ...picks].map(q => q.id));
    const fallback = slotA.filter(q => !alreadyIds.has(q.id));
    const need = TARGET - selected.length - picks.length;
    picks.push(...pickRandom(fallback, need));
  }

  // If STILL short, pull from any eligible
  if (selected.length + picks.length < TARGET) {
    const alreadyIds = new Set([...selected, ...picks].map(q => q.id));
    const fallback = eligible.filter(q => !alreadyIds.has(q.id));
    const need = TARGET - selected.length - picks.length;
    picks.push(...pickRandom(fallback, need));
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
      log[idx] = {
        ...log[idx],
        times_seen: timesSeen,
        last_seen_lesson: currentLessonOrder,
        next_due_lesson: nextDue,
        updated_at: now,
      };
    } else {
      log.push({
        class_id: classId,
        question_id: q.id,
        times_seen: timesSeen,
        last_seen_lesson: currentLessonOrder,
        next_due_lesson: nextDue,
        flagged: false,
        flag_resolved: false,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return log;
}
