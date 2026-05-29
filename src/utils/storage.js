import { doc, setDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';

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

// Encodes arbitrary strings into valid Firestore document ID segments
function encodeFirestoreId(str) {
  if (!str) return 'null';
  return str.replace(/[^a-zA-Z0-9-]/g, '_');
}

// Module-level Firebase user ID, set on login
let _userId = null;

export function setFirebaseUserId(uid) {
  _userId = uid;
}

// ─── Hydrate localStorage from Firestore on login ───────────────────────────

export async function hydrateFromFirestore(userId, email) {
  if (!db) return;
  _userId = userId;
  try {
    // All teachers (needed to show co-teachers on SetupPage)
    const teachersSnap = await getDocs(collection(db, 'teachers'));
    const teachers = teachersSnap.docs.map(d => d.data());
    setJSON(KEYS.TEACHERS, teachers);

    // All class options (HoD-managed list)
    const classesSnap = await getDocs(collection(db, 'classes'));
    setJSON(KEYS.CLASS_OPTIONS, classesSnap.docs.map(d => d.data()));

    // Classes this user is enrolled in
    const myClasses = teachers
      .filter(t => t.email === email && t.class_id)
      .map(t => t.class_id);

    if (myClasses.length > 0) {
      // Firestore 'in' supports up to 30 items; batch if needed
      const qLogEntries = [];
      const sLogEntries = [];
      for (let i = 0; i < myClasses.length; i += 30) {
        const batch = myClasses.slice(i, i + 30);
        const [qlSnap, slSnap] = await Promise.all([
          getDocs(query(collection(db, 'question_log'), where('class_id', 'in', batch))),
          getDocs(query(collection(db, 'session_log'), where('class_id', 'in', batch))),
        ]);
        qLogEntries.push(...qlSnap.docs.map(d => d.data()));
        sLogEntries.push(...slSnap.docs.map(d => d.data()));
      }
      setJSON(KEYS.QUESTION_LOG, qLogEntries);
      setJSON(KEYS.SESSION_LOG, sLogEntries);
    }
  } catch (err) {
    console.error('Firestore hydration error:', err);
  }
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export function getTeachers() {
  return getJSON(KEYS.TEACHERS, []);
}

export function saveTeachers(teachers) {
  setJSON(KEYS.TEACHERS, teachers);
}

// Enroll current user in a class (or register as HoD)
export function enrollTeacher(entry) {
  const all = getTeachers();
  all.push(entry);
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    const seg = encodeFirestoreId(entry.class_id || 'hod');
    setDoc(doc(db, 'teachers', `${_userId}__${seg}`), entry).catch(console.error);
  }
}

// Update rota for the current teacher's class enrollment
export function updateTeacherRota(classId, email, rotaId) {
  const all = getTeachers().map(t =>
    t.class_id === classId && t.email === email ? { ...t, rota_id: rotaId } : t
  );
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    const docId = `${_userId}__${encodeFirestoreId(classId)}`;
    setDoc(doc(db, 'teachers', docId), { rota_id: rotaId }, { merge: true }).catch(console.error);
  }
}

// Toggle HoD flag for current teacher
export function updateHoDFlag(email, isHoD) {
  const all = getTeachers().map(t =>
    t.email === email ? { ...t, is_hod: isHoD } : t
  );
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    const docRef = doc(db, 'teachers', `${_userId}__hod`);
    if (isHoD) {
      const existing = all.find(t => t.email === email && t.is_hod) || {
        email, is_hod: true, class_id: null, rota_id: null,
        created_at: new Date().toISOString(),
      };
      setDoc(docRef, existing, { merge: true }).catch(console.error);
    } else {
      deleteDoc(docRef).catch(console.error);
    }
  }
}

// ─── Current teacher ─────────────────────────────────────────────────────────

export function getCurrentTeacher() {
  return localStorage.getItem(KEYS.CURRENT_TEACHER) || null;
}

export function setCurrentTeacher(email) {
  localStorage.setItem(KEYS.CURRENT_TEACHER, email);
}

export function clearCurrentTeacher() {
  localStorage.removeItem(KEYS.CURRENT_TEACHER);
  _userId = null;
}

// ─── Class options (HoD-managed) ─────────────────────────────────────────────

export function getClassOptions() {
  return getJSON(KEYS.CLASS_OPTIONS, []);
}

export function saveClassOptions(options) {
  setJSON(KEYS.CLASS_OPTIONS, options);
}

// Add a new class option
export function addClassOption(classObj) {
  const all = getClassOptions();
  all.push(classObj);
  setJSON(KEYS.CLASS_OPTIONS, all);

  if (_userId && db) {
    setDoc(doc(db, 'classes', encodeFirestoreId(classObj.class_id)), classObj).catch(console.error);
  }
}

// Remove a class option by its UUID
export function removeClassOption(id) {
  const all = getClassOptions();
  const removed = all.find(o => o.id === id);
  setJSON(KEYS.CLASS_OPTIONS, all.filter(o => o.id !== id));

  if (_userId && db && removed) {
    deleteDoc(doc(db, 'classes', encodeFirestoreId(removed.class_id))).catch(console.error);
  }
}

// ─── Question log ─────────────────────────────────────────────────────────────

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

  if (_userId && db) {
    const docId = `${encodeFirestoreId(classId)}__${encodeFirestoreId(questionId)}`;
    setDoc(doc(db, 'question_log', docId), entry).catch(console.error);
  }

  return log;
}

// Write all question log entries for a class to Firestore (called after session end)
export function flushQuestionLogToFirestore(classId) {
  if (!_userId || !db) return;
  const entries = getQuestionLog().filter(e => e.class_id === classId);
  for (const e of entries) {
    const docId = `${encodeFirestoreId(classId)}__${encodeFirestoreId(e.question_id)}`;
    setDoc(doc(db, 'question_log', docId), e).catch(console.error);
  }
}

// ─── Session log ─────────────────────────────────────────────────────────────

export function getSessionLog() {
  return getJSON(KEYS.SESSION_LOG, []);
}

export function saveSessionLog(log) {
  setJSON(KEYS.SESSION_LOG, log);
}

// Append a single session entry (preferred over saveSessionLog for Firestore sync)
export function appendSession(entry) {
  const all = getSessionLog();
  all.push(entry);
  setJSON(KEYS.SESSION_LOG, all);

  if (_userId && db) {
    setDoc(doc(db, 'session_log', entry.id), entry).catch(console.error);
  }
}
