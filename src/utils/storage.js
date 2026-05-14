const KEYS = {
  TEACHERS: 'rs_teachers',
  QUESTION_LOG: 'rs_question_log',
  SESSION_LOG: 'rs_session_log',
  CURRENT_TEACHER: 'rs_current_teacher',
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

// Teachers
export function getTeachers() {
  return getJSON(KEYS.TEACHERS, []);
}

export function saveTeachers(teachers) {
  setJSON(KEYS.TEACHERS, teachers);
}

// Current teacher
export function getCurrentTeacher() {
  return localStorage.getItem(KEYS.CURRENT_TEACHER) || null;
}

export function setCurrentTeacher(email) {
  localStorage.setItem(KEYS.CURRENT_TEACHER, email);
}

export function clearCurrentTeacher() {
  localStorage.removeItem(KEYS.CURRENT_TEACHER);
}

// Question log
export function getQuestionLog() {
  return getJSON(KEYS.QUESTION_LOG, []);
}

export function saveQuestionLog(log) {
  setJSON(KEYS.QUESTION_LOG, log);
}

export function upsertQuestionLogEntry(classId, questionId, updates) {
  const log = getQuestionLog();
  const idx = log.findIndex(e => e.class_id === classId && e.question_id === questionId);
  const now = new Date().toISOString();
  if (idx >= 0) {
    log[idx] = { ...log[idx], ...updates, updated_at: now };
  } else {
    log.push({
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
    });
  }
  saveQuestionLog(log);
  return log;
}

// Session log
export function getSessionLog() {
  return getJSON(KEYS.SESSION_LOG, []);
}

export function saveSessionLog(log) {
  setJSON(KEYS.SESSION_LOG, log);
}
