// Lesson schedule: what each teacher has actually taught each class.
// Browsing never touches this; only opening a lesson in Teach mode does.
import {
  getScheduleEntries, saveScheduleEntry, deleteScheduleEntry,
  getSessionLog, appendSession, deleteSession,
  getQuestionLog, saveQuestionLog, flushQuestionLogToFirestore, replaceClassQuestionLog,
  getActiveRotas, getActiveQuestions, getTeachers, updateTeacherFields,
  getActiveSession, clearActiveSession,
} from './storage.js';
import { updateQuestionLog } from './scheduler.js';
import { generateUUID } from './uuid.js';
import {
  deliveredMapFrom, nextIndexFrom, pickNext, buildTimeline, inferHistory, migrateQuestionLog,
} from './scheduleLogic.js';

// Cache key shared by Preview and Teach, so a previewed question set (with any
// swaps) is exactly what gets taught
export const sessionKey = (index, lessonId) => `k${index}__${lessonId}`;

const undoKey = (classId, email) => `rs_undo__${classId}__${email}`;

export function getTeacher(classId, email) {
  return getTeachers().find(t => t.class_id === classId && t.email === email) || null;
}

export function getMySchedule(classId, email) {
  return getScheduleEntries()
    .filter(e => e.class_id === classId && e.teacher_email === email)
    .sort((a, b) => a.index - b.index);
}

// Every teacher's taught lessons for a class, oldest first
export function getClassTimeline(classId) {
  return getScheduleEntries()
    .filter(e => e.class_id === classId)
    .sort((a, b) => new Date(a.taught_at || 0) - new Date(b.taught_at || 0) || a.index - b.index);
}

// Lesson ids of a rota in teaching order (skipped lessons already removed)
export function getRotaSequence(rotaId) {
  return getActiveRotas()
    .filter(r => r.rota_id === rotaId)
    .sort((a, b) => a.lesson_order - b.lesson_order)
    .map(r => r.lesson_id);
}

export function getDeliveredMap(classId, email, beforeIndex = Infinity) {
  return deliveredMapFrom(getMySchedule(classId, email), beforeIndex);
}

export function getNextIndex(classId, email) {
  return nextIndexFrom(getMySchedule(classId, email));
}

export function getNextLesson(classId, email) {
  const t = getTeacher(classId, email);
  if (!t) return { lessonId: null, planned: false, suggested: null };
  return pickNext({
    schedule: getMySchedule(classId, email),
    rotaSequence: getRotaSequence(t.rota_id),
    plannedNext: t.planned_next || null,
  });
}

export function getTimeline(classId, email) {
  const t = getTeacher(classId, email);
  if (!t) return [];
  return buildTimeline({
    schedule: getMySchedule(classId, email),
    rotaSequence: getRotaSequence(t.rota_id),
    plannedNext: t.planned_next || null,
  });
}

export function setPlannedNext(classId, email, lessonId) {
  updateTeacherFields(classId, email, { planned_next: lessonId || null });
}

// ─── Reboarding (one-off check of migrated history) ──────────────────────────

function hasOldHistory(classId, email) {
  return getSessionLog().some(s => s.class_id === classId && s.teacher_email === email && s.lesson_order !== -1);
}

// Teach is blocked until a teacher with old history has checked it
export function needsReboarding(classId, email) {
  const t = getTeacher(classId, email);
  if (!t || t.schedule_confirmed) return false;
  if (getMySchedule(classId, email).length > 0) return false;
  return hasOldHistory(classId, email);
}

// Teachers with no history have nothing to check
export function autoConfirmIfNew(classId, email) {
  const t = getTeacher(classId, email);
  if (!t || t.schedule_confirmed) return;
  if (!hasOldHistory(classId, email)) {
    updateTeacherFields(classId, email, { schedule_confirmed: true, schedule_confirmed_at: new Date().toISOString() });
  }
}

export function inferHistoryFor(classId, email) {
  const t = getTeacher(classId, email);
  const sessions = getSessionLog().filter(s => s.class_id === classId && s.teacher_email === email);
  return inferHistory({ sessions, rotaSequence: getRotaSequence(t?.rota_id), rotaId: t?.rota_id });
}

function clearClassCaches(classId) {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`rs_active_session__${classId}__`)) localStorage.removeItem(k);
  }
}

// Save a checked history: rebuilds the schedule (rota order) and cleans the
// question log so recall only uses lessons actually taught.
export function confirmHistory(classId, email, lessonIds, dateByLesson = {}) {
  const t = getTeacher(classId, email);
  if (!t) return;
  const seq = getRotaSequence(t.rota_id);
  const chosen = new Set(lessonIds);
  const ordered = seq.filter(id => chosen.has(id));
  const firstTime = !t.schedule_confirmed;

  const existing = getMySchedule(classId, email);
  const keptDate = Object.fromEntries(existing.map(e => [e.lesson_id, e.taught_at]));
  existing.forEach(e => deleteScheduleEntry(e.id));
  ordered.forEach((lessonId, i) => saveScheduleEntry({
    id: generateUUID(),
    class_id: classId,
    teacher_email: email,
    lesson_id: lessonId,
    index: i + 1,
    taught_at: keptDate[lessonId] || dateByLesson[lessonId] || null,
    source: firstTime ? 'migrated' : 'edited',
    finalized: true,
  }));

  const lessonOfQuestion = new Map(getActiveQuestions().map(q => [q.id, q.lesson_id]));
  replaceClassQuestionLog(classId, migrateQuestionLog({
    entries: getQuestionLog().filter(e => e.class_id === classId),
    myRotaSequence: seq,
    confirmedLessonIds: ordered,
    lessonOfQuestion,
    email,
    rescale: firstTime,
  }));

  clearClassCaches(classId);
  localStorage.removeItem(undoKey(classId, email));
  updateTeacherFields(classId, email, { schedule_confirmed: true, schedule_confirmed_at: new Date().toISOString() });
}

// ─── Teaching ─────────────────────────────────────────────────────────────────

// Opening a lesson in Teach mode records it as taught straight away.
// A snapshot of the question log is kept so the last lesson can be undone.
export function startTeach(classId, email, lessonId) {
  const index = getNextIndex(classId, email);
  const now = new Date().toISOString();
  const sessionId = generateUUID();
  const entry = {
    id: generateUUID(),
    class_id: classId,
    teacher_email: email,
    lesson_id: lessonId,
    index,
    taught_at: now,
    source: 'teach',
    finalized: false,
    session_id: sessionId,
  };

  localStorage.setItem(undoKey(classId, email), JSON.stringify({
    entryId: entry.id,
    questionLog: getQuestionLog().filter(e => e.class_id === classId),
  }));

  saveScheduleEntry(entry);
  setPlannedNext(classId, email, null);
  appendSession({
    id: sessionId,
    class_id: classId,
    teacher_email: email,
    lesson_order: index,
    lesson_id: lessonId,
    opened_at: now,
    schedule_entry_id: entry.id,
  });
  return entry;
}

// The lesson currently being taught (opened in Teach, not yet ended)
export function getOpenEntry(classId, email, lessonId) {
  return [...getMySchedule(classId, email)].reverse()
    .find(e => e.lesson_id === lessonId && !e.finalized) || null;
}

// Ending the starter updates spaced repetition for the questions shown
export function finalizeEntry(entry, shownQuestions) {
  if (shownQuestions.length > 0) {
    saveQuestionLog(updateQuestionLog(entry.class_id, shownQuestions, entry.index, getQuestionLog(), entry.teacher_email));
    flushQuestionLogToFirestore(entry.class_id);
  }
  saveScheduleEntry({ ...entry, finalized: true, finalized_at: new Date().toISOString() });
  clearActiveSession(entry.class_id, sessionKey(entry.index, entry.lesson_id));
}

// A starter left open (tab closed, back button) is finalised the next time
// the class is opened, using whatever questions were on screen
export function autoFinalize(classId, email) {
  for (const e of getMySchedule(classId, email).filter(s => !s.finalized)) {
    const cached = getActiveSession(classId, sessionKey(e.index, e.lesson_id));
    finalizeEntry(e, (cached?.questions || []).filter(Boolean));
  }
}

// Undo the most recent taught lesson. Recall data is restored from the
// snapshot when it was taken on this device.
export function undoLastLesson(classId, email) {
  const schedule = getMySchedule(classId, email);
  const last = schedule[schedule.length - 1];
  if (!last) return null;

  let restored = false;
  try {
    const snap = JSON.parse(localStorage.getItem(undoKey(classId, email)) || 'null');
    if (snap && snap.entryId === last.id) {
      const t = getTeacher(classId, email);
      const mine = new Set(getRotaSequence(t?.rota_id));
      const lessonOf = new Map(getActiveQuestions().map(q => [q.id, q.lesson_id]));
      const isMine = e => mine.has(lessonOf.get(e.question_id));
      const current = getQuestionLog().filter(e => e.class_id === classId);
      // Only roll back this teacher's content; leave co-teachers' progress alone
      replaceClassQuestionLog(classId, [...current.filter(e => !isMine(e)), ...snap.questionLog.filter(isMine)]);
      restored = true;
    }
  } catch { /* no usable snapshot */ }

  deleteScheduleEntry(last.id);
  if (last.session_id) deleteSession(last.session_id);
  clearActiveSession(classId, sessionKey(last.index, last.lesson_id));
  localStorage.removeItem(undoKey(classId, email));
  return { restored, lessonId: last.lesson_id };
}
