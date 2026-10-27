// Pure lesson-schedule logic (no storage / Firebase imports, so it can be
// tested directly). A teacher's schedule is the ordered list of lessons they
// have actually taught a class; its `index` (1, 2, 3…) is the clock that
// spaced repetition runs on.

// Lessons per fortnight for each rota — used to sanity-check inferred history
const PACE = { 'rota-a': 6, 'rota-b-t1': 4, 'rota-b-t2': 2, 'rota-c-t1': 3, 'rota-c-t2': 3 };

export function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// lesson_id → most recent index it was taught at (only indexes < beforeIndex)
export function deliveredMapFrom(schedule, beforeIndex = Infinity) {
  const map = {};
  for (const e of [...schedule].sort((a, b) => a.index - b.index)) {
    if (e.index < beforeIndex) map[e.lesson_id] = e.index;
  }
  return map;
}

export function nextIndexFrom(schedule) {
  return schedule.reduce((m, e) => Math.max(m, e.index), 0) + 1;
}

// Rota lessons not yet taught, in rota order
export function upcomingFrom(schedule, rotaSequence) {
  const taught = new Set(schedule.map(e => e.lesson_id));
  return rotaSequence.filter(id => !taught.has(id));
}

// What gets taught next: the teacher's dragged-in choice, otherwise the first
// untaught lesson in rota order (the ghosted suggestion)
export function pickNext({ schedule, rotaSequence, plannedNext }) {
  const suggested = upcomingFrom(schedule, rotaSequence)[0] || null;
  if (plannedNext) return { lessonId: plannedNext, planned: true, suggested };
  return { lessonId: suggested, planned: false, suggested };
}

// Taught lessons followed by the projected upcoming ones, each with an index
export function buildTimeline({ schedule, rotaSequence, plannedNext }) {
  const delivered = [...schedule]
    .sort((a, b) => a.index - b.index)
    .map(e => ({ index: e.index, lesson_id: e.lesson_id, delivered: true, taught_at: e.taught_at || null }));
  let i = nextIndexFrom(schedule);
  const upcoming = upcomingFrom(schedule, rotaSequence);
  const order = plannedNext ? [plannedNext, ...upcoming.filter(id => id !== plannedNext)] : upcoming;
  return [...delivered, ...order.map(id => ({ index: i++, lesson_id: id, delivered: false }))];
}

// Best guess of what a teacher has taught, from their old session history.
// Each distinct day they ran a normal starter counts as one lesson, so several
// look-ahead opens on one day only count once.
// Lessons taught with Teach are known exactly (their session points at a
// schedule entry); only older sessions need the one-lesson-per-day guess.
export function inferHistory({ sessions, rotaSequence, rotaId, now = new Date() }) {
  const taught = sessions
    .filter(s => s.lesson_order !== -1 && s.opened_at)
    .sort((a, b) => new Date(a.opened_at) - new Date(b.opened_at));
  const viaTeach = taught.filter(s => s.schedule_entry_id && s.lesson_id);
  const older = taught.filter(s => !s.schedule_entry_id);

  const firstOpenOfDay = new Map();
  for (const s of older) {
    const day = localDay(s.opened_at);
    if (!firstOpenOfDay.has(day)) firstOpenOfDay.set(day, s.opened_at);
  }
  const days = [...firstOpenOfDay.values()];

  const count = Math.min(days.length, rotaSequence.length);
  const guessed = rotaSequence.slice(0, count);
  const dateByLesson = {};
  guessed.forEach((id, i) => { dateByLesson[id] = days[i]; });
  for (const s of viaTeach) {
    if (!dateByLesson[s.lesson_id]) dateByLesson[s.lesson_id] = s.opened_at;
  }
  const position = new Map(rotaSequence.map((id, i) => [id, i]));
  const lessonIds = [...new Set([...guessed, ...viaTeach.map(s => s.lesson_id)])]
    .sort((a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity));

  // Expected lessons from the time elapsed and the rota's pace
  let expected = null;
  if (taught.length) {
    const weeks = Math.max(0, (now - new Date(taught[0].opened_at)) / (7 * 864e5));
    expected = Math.max(1, Math.round((weeks * (PACE[rotaId] || 6)) / 2));
  }
  const offPace = expected != null && Math.abs(lessonIds.length - expected) > Math.max(3, expected * 0.5);

  // Furthest lesson they ever opened (often a look-ahead)
  let furthestLessonId = null;
  for (const s of taught) {
    if (position.has(s.lesson_id) && (furthestLessonId == null || position.get(s.lesson_id) > position.get(furthestLessonId))) {
      furthestLessonId = s.lesson_id;
    }
  }

  return { lessonIds, dateByLesson, daysCount: days.length + new Set(viaTeach.map(s => localDay(s.opened_at))).size, expected, offPace, furthestLessonId };
}

// Rewrite a class's question log against a confirmed schedule.
// - Questions from the teacher's own rota whose lesson is NOT on the schedule
//   are dropped (that's the looked-ahead content leaking into starters).
// - With `rescale`, clock values are converted from the old rota-position clock
//   to the new taught-lesson clock. A clock value k meant "while teaching the
//   lesson at rota position k", which becomes (taught lessons before k) + 1.
// - Questions from other teachers' rotas are left untouched.
export function migrateQuestionLog({ entries, myRotaSequence, confirmedLessonIds, lessonOfQuestion, email, rescale }) {
  const mine = new Set(myRotaSequence);
  const confirmed = new Set(confirmedLessonIds);
  const positionOf = new Map(myRotaSequence.map((id, i) => [id, i + 1]));
  const confirmedPositions = confirmedLessonIds.map(id => positionOf.get(id)).filter(Boolean);
  const toNew = old => confirmedPositions.filter(p => p < old).length + 1;

  const out = [];
  for (const e of entries) {
    const lesson = lessonOfQuestion.get(e.question_id);
    if (!lesson || !mine.has(lesson)) { out.push(e); continue; }
    if (!confirmed.has(lesson)) continue;
    if (!rescale) { out.push({ ...e, teacher_email: email }); continue; }

    const last = e.last_seen_lesson;
    const due = e.next_due_lesson ?? 0;
    const newLast = last == null ? null : toNew(last);
    let newDue;
    if (due === 0) newDue = 0;
    else if (last == null) newDue = toNew(due);
    else newDue = Math.max(0, newLast + (due - last));
    out.push({ ...e, last_seen_lesson: newLast, next_due_lesson: newDue, teacher_email: email });
  }
  return out;
}

// Combine the server's schedule entries with this device's on login.
// - A server entry wins, unless this device has an edit that hasn't synced yet.
// - A device-only entry that never synced (e.g. saved before the rules were
//   published) is kept so it can be sent again.
// - A device-only entry that did sync was removed elsewhere, so it's dropped.
// Returns the merged list (server copies marked _synced) and what to re-send.
export function mergeSchedules(remote, local, email) {
  const localById = new Map(local.map(e => [e.id, e]));
  const remoteIds = new Set(remote.map(e => e.id));
  const merged = remote.map(r => {
    const l = localById.get(r.id);
    return l && !l._synced ? l : { ...r, _synced: true };
  });
  const localOnly = local.filter(e => !remoteIds.has(e.id) && !e._synced && e.teacher_email === email);
  const all = [...merged, ...localOnly];
  return { entries: all, toPush: all.filter(e => !e._synced) };
}
