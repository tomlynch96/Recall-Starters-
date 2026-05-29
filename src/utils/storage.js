import { supabase } from './supabase.js';
import { generateUUID } from './uuid.js';

const KEYS = {
  TEACHERS: 'rs_teachers',
  QUESTION_LOG: 'rs_question_log',
  SESSION_LOG: 'rs_session_log',
  CURRENT_TEACHER: 'rs_current_teacher',
  CLASS_OPTIONS: 'rs_class_options',
};

function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUserId() {
  return localStorage.getItem('rs_user_id');
}

// ── Teachers ──────────────────────────────────────────────────

export function getTeachers() {
  return getJSON(KEYS.TEACHERS, []);
}

export function saveTeachers(teachers) {
  setJSON(KEYS.TEACHERS, teachers);
}

// Enroll current user in a class. Writes localStorage + Supabase.
export async function enrollTeacher({ email, classId, rotaId, isHod = false }) {

  const userId = getUserId();
  const newEntry = {
    id: generateUUID(),
    email,
    class_id: classId,
    rota_id: rotaId,
    is_hod: isHod,
    created_at: new Date().toISOString(),
  };

  const all = getTeachers();
  all.push(newEntry);
  saveTeachers(all);

  if (userId) {
    supabase.from('teachers').insert({
      user_id: userId,
      email,
      class_id: classId,
      rota_id: rotaId,
      is_hod: isHod,
    }).then(({ error }) => { if (error) console.warn('Supabase teacher insert:', error.message); });
  }

  return newEntry;
}

// Update rota for current teacher in a class. Writes localStorage + Supabase.
export function updateTeacherRota(email, classId, newRotaId) {
  const userId = getUserId();
  const updated = getTeachers().map(t =>
    t.class_id === classId && t.email === email ? { ...t, rota_id: newRotaId } : t
  );
  saveTeachers(updated);

  if (userId) {
    supabase.from('teachers')
      .update({ rota_id: newRotaId })
      .eq('user_id', userId)
      .eq('class_id', classId)
      .then(({ error }) => { if (error) console.warn('Supabase rota update:', error.message); });
  }
}

// Toggle HoD flag. Writes localStorage + Supabase.
export function updateHoDFlag(email, isHod) {
  const userId = getUserId();
  saveTeachers(getTeachers().map(t => t.email === email ? { ...t, is_hod: isHod } : t));

  if (userId) {
    supabase.from('teachers')
      .update({ is_hod: isHod })
      .eq('user_id', userId)
      .then(({ error }) => { if (error) console.warn('Supabase HoD update:', error.message); });
  }
}

// ── Current teacher ───────────────────────────────────────────

export function getCurrentTeacher() {
  return localStorage.getItem(KEYS.CURRENT_TEACHER) || null;
}

export function setCurrentTeacher(email) {
  localStorage.setItem(KEYS.CURRENT_TEACHER, email);
}

export function clearCurrentTeacher() {
  localStorage.removeItem(KEYS.CURRENT_TEACHER);
}

// ── Question log ──────────────────────────────────────────────

export function getQuestionLog() {
  return getJSON(KEYS.QUESTION_LOG, []);
}

export function saveQuestionLog(log) {
  setJSON(KEYS.QUESTION_LOG, log);
}

// Bulk sync to Supabase after a session ends.
export function syncQuestionLog(entries) {
  const rows = entries.map(e => ({
    class_id:         e.class_id,
    question_id:      e.question_id,
    times_seen:       e.times_seen,
    last_seen_lesson: e.last_seen_lesson,
    next_due_lesson:  e.next_due_lesson,
    flagged:          e.flagged,
    flag_resolved:    e.flag_resolved,
    updated_at:       e.updated_at,
  }));

  supabase.from('question_log')
    .upsert(rows, { onConflict: 'class_id,question_id' })
    .then(({ error }) => { if (error) console.warn('Supabase question_log sync:', error.message); });
}

export function upsertQuestionLogEntry(classId, questionId, updates) {
  const log = getQuestionLog();
  const idx = log.findIndex(e => e.class_id === classId && e.question_id === questionId);
  const now = new Date().toISOString();

  let entry;
  if (idx >= 0) {
    log[idx] = { ...log[idx], ...updates, updated_at: now };
    entry = log[idx];
  } else {
    entry = {
      class_id: classId,
      question_id: questionId,
      times_seen: 0,
      last_seen_lesson: null,
      next_due_lesson: 0,
      flagged: false,
      flag_resolved: false,
      created_at: now,
      updated_at: now,
      ...updates,
    };
    log.push(entry);
  }
  saveQuestionLog(log);

  // Write-through — important for flag sharing between co-teachers
  supabase.from('question_log')
    .upsert({
      class_id:         entry.class_id,
      question_id:      entry.question_id,
      times_seen:       entry.times_seen,
      last_seen_lesson: entry.last_seen_lesson,
      next_due_lesson:  entry.next_due_lesson,
      flagged:          entry.flagged,
      flag_resolved:    entry.flag_resolved,
      updated_at:       entry.updated_at,
    }, { onConflict: 'class_id,question_id' })
    .then(({ error }) => { if (error) console.warn('Supabase question_log upsert:', error.message); });

  return log;
}

// ── Class options ─────────────────────────────────────────────

export function getClassOptions() {
  return getJSON(KEYS.CLASS_OPTIONS, []);
}

export function saveClassOptions(options) {
  setJSON(KEYS.CLASS_OPTIONS, options);
}

// Add a class. Writes localStorage + Supabase.
export async function addClass(name) {

  const userId = getUserId();
  if (getClassOptions().find(o => o.class_id === name)) return null;

  const newOption = { id: generateUUID(), class_id: name };
  saveClassOptions([...getClassOptions(), newOption]);

  if (userId) {
    supabase.from('classes')
      .insert({ class_id: name, created_by: userId })
      .then(({ error }) => { if (error) console.warn('Supabase class insert:', error.message); });
  }

  return newOption;
}

// Remove a class. Writes localStorage + Supabase.
export function removeClass(optionId) {
  const existing = getClassOptions();
  const option = existing.find(o => o.id === optionId);
  saveClassOptions(existing.filter(o => o.id !== optionId));

  if (option) {
    supabase.from('classes')
      .delete()
      .eq('class_id', option.class_id)
      .then(({ error }) => { if (error) console.warn('Supabase class delete:', error.message); });
  }
}

// ── Session log ───────────────────────────────────────────────

export function getSessionLog() {
  return getJSON(KEYS.SESSION_LOG, []);
}

export function saveSessionLog(log) {
  setJSON(KEYS.SESSION_LOG, log);
}

// Append a session entry. Writes localStorage + Supabase.
export function appendSession(entry) {
  const userId = getUserId();
  saveSessionLog([...getSessionLog(), entry]);

  if (userId) {
    supabase.from('session_log').insert({
      id:            entry.id,
      class_id:      entry.class_id,
      user_id:       userId,
      teacher_email: entry.teacher_email,
      lesson_order:  entry.lesson_order,
      lesson_id:     entry.lesson_id || null,
      opened_at:     entry.opened_at,
    }).then(({ error }) => { if (error) console.warn('Supabase session_log insert:', error.message); });
  }
}
