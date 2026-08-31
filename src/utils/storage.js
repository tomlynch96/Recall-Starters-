import { doc, setDoc, deleteDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase.js';
import { QUESTIONS, CHALLENGE_PLUS, ROTAS } from '../data/staticData.js';

const KEYS = {
  TEACHERS: 'rs_teachers',
  QUESTION_LOG: 'rs_question_log',
  SESSION_LOG: 'rs_session_log',
  CURRENT_TEACHER: 'rs_current_teacher',
  CLASS_OPTIONS: 'rs_class_options',
  CUSTOM_QUESTIONS: 'rs_custom_questions',
  CUSTOM_CHALLENGE_PLUS: 'rs_custom_challenge_plus',
  CUSTOM_ROTAS: 'rs_custom_rotas',
  QUESTION_VERSIONS: 'rs_question_versions',
};

// Keep at most this many full version snapshots (Firestore doc size limit)
const MAX_VERSIONS = 8;

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
    // Phase 1 (blocking): fetch teachers, classes, custom questions
    const [teachersSnap, classesSnap, customQSnap, challengeSnap, rotasSnap, historySnap] = await Promise.all([
      getDocs(collection(db, 'teachers')),
      getDocs(collection(db, 'classes')),
      getDoc(doc(db, 'config', 'custom_questions')),
      getDoc(doc(db, 'config', 'challenge_plus')),
      getDoc(doc(db, 'config', 'custom_rotas')),
      getDoc(doc(db, 'config', 'questions_history')),
    ]);
    const teachers = teachersSnap.docs.map(d => d.data());
    setJSON(KEYS.TEACHERS, teachers);
    setJSON(KEYS.CLASS_OPTIONS, classesSnap.docs.map(d => d.data()));
    if (customQSnap.exists()) {
      setJSON(KEYS.CUSTOM_QUESTIONS, customQSnap.data().questions);
    } else {
      localStorage.removeItem(KEYS.CUSTOM_QUESTIONS);
    }
    if (challengeSnap.exists()) {
      setJSON(KEYS.CUSTOM_CHALLENGE_PLUS, challengeSnap.data().entries);
    } else {
      localStorage.removeItem(KEYS.CUSTOM_CHALLENGE_PLUS);
    }
    if (rotasSnap.exists()) {
      setJSON(KEYS.CUSTOM_ROTAS, rotasSnap.data().entries);
    } else {
      localStorage.removeItem(KEYS.CUSTOM_ROTAS);
    }
    if (historySnap.exists()) {
      setJSON(KEYS.QUESTION_VERSIONS, historySnap.data().versions);
    } else {
      localStorage.removeItem(KEYS.QUESTION_VERSIONS);
    }

    // Phase 2 (background): fetch question log + session log — not needed until StarterPage
    const myClasses = teachers
      .filter(t => t.email === email && t.class_id)
      .map(t => t.class_id);

    if (myClasses.length > 0) {
      const fetchBackground = async () => {
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
      };
      fetchBackground().catch(err => console.error('Firestore background hydration error:', err));
    }
  } catch (err) {
    console.error('Firestore hydration error:', err);
    throw err; // re-throw so AuthContext can surface it
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
    setDoc(doc(db, 'teachers', `${_userId}__${seg}`), entry).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// Remove current teacher's enrollment from a class
export function unenrollTeacher(email, classId) {
  const all = getTeachers().filter(t => !(t.email === email && t.class_id === classId));
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    deleteDoc(doc(db, 'teachers', `${_userId}__${encodeFirestoreId(classId)}`))
      .catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}


export function updateTeacherRota(classId, email, rotaId) {
  const all = getTeachers().map(t =>
    t.class_id === classId && t.email === email ? { ...t, rota_id: rotaId } : t
  );
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    const docId = `${_userId}__${encodeFirestoreId(classId)}`;
    setDoc(doc(db, 'teachers', docId), { rota_id: rotaId }, { merge: true }).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// Set the teacher's preferred starter size (6 or 8) for a class
export function updateTeacherStarterSize(classId, email, size) {
  const all = getTeachers().map(t =>
    t.class_id === classId && t.email === email ? { ...t, starter_size: size } : t
  );
  setJSON(KEYS.TEACHERS, all);

  if (_userId && db) {
    const docId = `${_userId}__${encodeFirestoreId(classId)}`;
    setDoc(doc(db, 'teachers', docId), { starter_size: size }, { merge: true }).catch(err => console.error('Firestore write failed:', err.code, err.message));
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
      setDoc(docRef, {
        id: `${_userId}__hod`,
        email,
        is_hod: true,
        class_id: null,
        rota_id: null,
        created_at: new Date().toISOString(),
      }).catch(err => console.error('Firestore write failed:', err.code, err.message));
    } else {
      deleteDoc(docRef).catch(err => console.error('Firestore write failed:', err.code, err.message));
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
    setDoc(doc(db, 'classes', encodeFirestoreId(classObj.class_id)), classObj).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// Remove a class option by its UUID
export function removeClassOption(id) {
  const all = getClassOptions();
  const removed = all.find(o => o.id === id);
  setJSON(KEYS.CLASS_OPTIONS, all.filter(o => o.id !== id));

  if (_userId && db && removed) {
    deleteDoc(doc(db, 'classes', encodeFirestoreId(removed.class_id))).catch(err => console.error('Firestore write failed:', err.code, err.message));
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
    setDoc(doc(db, 'question_log', docId), entry).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }

  return log;
}

// Write all question log entries for a class to Firestore (called after session end)
export function flushQuestionLogToFirestore(classId) {
  if (!_userId || !db) return;
  const entries = getQuestionLog().filter(e => e.class_id === classId);
  for (const e of entries) {
    const docId = `${encodeFirestoreId(classId)}__${encodeFirestoreId(e.question_id)}`;
    setDoc(doc(db, 'question_log', docId), e).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// Reset a teacher's progress for a class back to zero: clears their session
// history (lesson position) and the class's question log (spaced-repetition +
// flags, which are shared across co-teachers of that class).
export function resetClassProgress(classId, email) {
  // 1. Session log — remove this teacher's sessions for the class
  const sessions = getSessionLog();
  const removedSessions = sessions.filter(s => s.class_id === classId && s.teacher_email === email);
  setJSON(KEYS.SESSION_LOG, sessions.filter(s => !(s.class_id === classId && s.teacher_email === email)));

  // 2. Question log — clear the class's spaced-repetition / flag state
  const qlog = getQuestionLog();
  const removedQ = qlog.filter(e => e.class_id === classId);
  setJSON(KEYS.QUESTION_LOG, qlog.filter(e => e.class_id !== classId));

  // 3. Drop any cached in-progress starter for this class
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`rs_active_session__${classId}__`)) localStorage.removeItem(k);
  }

  // 4. Mirror the deletes to Firestore
  if (_userId && db) {
    for (const s of removedSessions) {
      if (s.id) deleteDoc(doc(db, 'session_log', s.id)).catch(err => console.error('Firestore write failed:', err.code, err.message));
    }
    for (const e of removedQ) {
      const docId = `${encodeFirestoreId(classId)}__${encodeFirestoreId(e.question_id)}`;
      deleteDoc(doc(db, 'question_log', docId)).catch(err => console.error('Firestore write failed:', err.code, err.message));
    }
  }

  // Keep the plaza brain size in step with the reduced session count
  updatePlazaStats(email);
}

// ─── Custom questions (HoD-managed overrides) ────────────────────────────────

export function getCustomQuestions() {
  return getJSON(KEYS.CUSTOM_QUESTIONS, null);
}

// Returns custom questions if the HoD has uploaded them, otherwise the bundled defaults
export function getActiveQuestions() {
  const custom = getCustomQuestions();
  return custom && custom.length > 0 ? custom : QUESTIONS;
}

export function saveCustomQuestions(questions) {
  setJSON(KEYS.CUSTOM_QUESTIONS, questions);
  if (_userId && db) {
    setDoc(doc(db, 'config', 'custom_questions'), {
      questions,
      updated_at: new Date().toISOString(),
    }).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

export function clearCustomQuestions() {
  localStorage.removeItem(KEYS.CUSTOM_QUESTIONS);
  if (_userId && db) {
    deleteDoc(doc(db, 'config', 'custom_questions'))
      .catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// ─── Custom challenge+ questions ─────────────────────────────────────────────

export function getCustomChallengePlus() {
  return getJSON(KEYS.CUSTOM_CHALLENGE_PLUS, null);
}

export function getActiveChallengePlus() {
  const custom = getCustomChallengePlus();
  return custom !== null ? custom : CHALLENGE_PLUS;
}

export function saveCustomChallengePlus(entries) {
  setJSON(KEYS.CUSTOM_CHALLENGE_PLUS, entries);
  if (_userId && db) {
    setDoc(doc(db, 'config', 'challenge_plus'), {
      entries,
      updated_at: new Date().toISOString(),
    }).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

export function clearCustomChallengePlus() {
  localStorage.removeItem(KEYS.CUSTOM_CHALLENGE_PLUS);
  if (_userId && db) {
    deleteDoc(doc(db, 'config', 'challenge_plus'))
      .catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// ─── Custom rotas (HoD-editable topic sequencing) ────────────────────────────
// A rota is an array of { rota_id, rota_name, lesson_id, lesson_order }. The HoD
// can reorder the topic blocks within a rota; the result is saved here and
// overrides the bundled ROTAS everywhere (scheduler, lesson picker, dashboard).

export function getCustomRotas() {
  return getJSON(KEYS.CUSTOM_ROTAS, null);
}

export function getActiveRotas() {
  const custom = getCustomRotas();
  return custom && custom.length > 0 ? custom : ROTAS;
}

export function saveCustomRotas(entries) {
  setJSON(KEYS.CUSTOM_ROTAS, entries);
  if (_userId && db) {
    setDoc(doc(db, 'config', 'custom_rotas'), {
      entries,
      updated_at: new Date().toISOString(),
    }).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

export function clearCustomRotas() {
  localStorage.removeItem(KEYS.CUSTOM_ROTAS);
  if (_userId && db) {
    deleteDoc(doc(db, 'config', 'custom_rotas'))
      .catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
}

// ─── Question bank version history ───────────────────────────────────────────
// Each version records who uploaded, when, what kind (full / per-topic), and a
// snapshot of the whole bank at that point so it can be redownloaded/restored.

export function getQuestionVersions() {
  return getJSON(KEYS.QUESTION_VERSIONS, []);
}

// Prepend a version and persist (capped to MAX_VERSIONS, newest first)
export function pushQuestionVersion(entry) {
  const versions = [entry, ...getQuestionVersions()].slice(0, MAX_VERSIONS);
  setJSON(KEYS.QUESTION_VERSIONS, versions);
  if (_userId && db) {
    setDoc(doc(db, 'config', 'questions_history'), {
      versions,
      updated_at: new Date().toISOString(),
    }).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }
  return versions;
}

// ─── Active starter session (persists question list across navigation) ────────

function activeSessionKey(classId, lessonKey) {
  return `rs_active_session__${classId}__${lessonKey}`;
}

export function saveActiveSession(classId, lessonKey, questions, meta = {}) {
  localStorage.setItem(activeSessionKey(classId, lessonKey), JSON.stringify({ questions, ...meta }));
}

export function getActiveSession(classId, lessonKey) {
  try {
    const raw = localStorage.getItem(activeSessionKey(classId, lessonKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveSession(classId, lessonKey) {
  localStorage.removeItem(activeSessionKey(classId, lessonKey));
}

// ─── Brain Plaza stats ───────────────────────────────────────────────────────
// Each teacher publishes their own total session count so everyone's brain is
// sized correctly in the plaza, even for colleagues whose class session logs
// aren't synced to this device.

export function updatePlazaStats(email) {
  if (!db || !email) return;
  const count = getSessionLog().filter(s => s.teacher_email === email).length;
  setDoc(doc(db, 'plaza_stats', encodeFirestoreId(email)), {
    email,
    sessions: count,
    updated_at: new Date().toISOString(),
  }, { merge: true }).catch(err => console.error('Firestore write failed:', err.code, err.message));
}

export async function fetchPlazaStats() {
  if (!db) return {};
  const snap = await getDocs(collection(db, 'plaza_stats'));
  const map = {};
  for (const d of snap.docs) {
    const data = d.data();
    if (data.email) map[data.email] = data.sessions || 0;
  }
  return map;
}

// ─── Brain Plaza messages (easter egg) ───────────────────────────────────────

// Fetch messages left for this teacher in the plaza
export async function fetchPlazaMessages(email) {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, 'plaza_messages'), where('to_email', '==', email)));
  return snap.docs
    .map(d => ({ docId: d.id, ...d.data() }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

// Leave a message for another teacher — they'll see it next time they visit the plaza
export function leavePlazaMessage(msg) {
  if (!db) return;
  setDoc(doc(db, 'plaza_messages', msg.id), msg)
    .catch(err => console.error('Firestore write failed:', err.code, err.message));
}

// Delete a message once it's been read
export function deletePlazaMessage(docId) {
  if (!db) return;
  deleteDoc(doc(db, 'plaza_messages', docId))
    .catch(err => console.error('Firestore write failed:', err.code, err.message));
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
    setDoc(doc(db, 'session_log', entry.id), entry).catch(err => console.error('Firestore write failed:', err.code, err.message));
  }

  // Keep the plaza brain size in sync with real usage
  if (entry.teacher_email) updatePlazaStats(entry.teacher_email);
}
