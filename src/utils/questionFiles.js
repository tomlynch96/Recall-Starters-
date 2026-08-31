// Helpers for parsing/building question-bank Excel files, plus lesson-order
// comparison used to warn the HoD when an upload sequences lessons differently
// from the natural (alphabetical) lesson_id order.
import * as XLSX from 'xlsx';
import { LESSONS } from '../data/staticData.js';

const lessonMetaById = new Map(LESSONS.map(l => [l.lesson_id, l]));

// Parse a question-bank workbook (full bank or a per-topic file).
// Returns questions (without final ids — caller assigns), challenge+ rows,
// the set of topics present, and the order lessons first appear in the file.
export function parseQuestionWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer);

  const wsQ = wb.Sheets['Questions'] || wb.Sheets[wb.SheetNames[0]];
  const qRows = wsQ ? XLSX.utils.sheet_to_json(wsQ, { defval: '' }) : [];

  const questions = [];
  const topics = new Set();
  const fileOrderByTopic = new Map(); // topic_name -> [lesson_id in first-appearance order]
  const seenLesson = new Set();

  for (const r of qRows) {
    const question = String(r.Question || '').trim();
    if (!question) continue;
    const lessonId = String(r.lesson_id || '').trim();
    const meta = lessonMetaById.get(lessonId);
    const topicName = meta ? meta.topic_name : '';

    questions.push({
      id: String(r.id || '').trim(),
      lesson_id: lessonId,
      topic_id: meta ? meta.topic_id : '',
      topic_name: topicName,
      lesson_number: meta ? meta.lesson_number : '',
      lesson_title: meta ? meta.lesson_title : String(r.Lesson || '').trim(),
      question,
      answer: String(r.Answer || '').trim(),
      scaffolded: String(r.Scaffold || '').trim(),
    });

    if (topicName) {
      topics.add(topicName);
      if (lessonId && !seenLesson.has(lessonId)) {
        seenLesson.add(lessonId);
        if (!fileOrderByTopic.has(topicName)) fileOrderByTopic.set(topicName, []);
        fileOrderByTopic.get(topicName).push(lessonId);
      }
    }
  }

  // Challenge+ sheet (flexible name)
  const cName = wb.SheetNames.find(n => n.toLowerCase().includes('challenge')) || wb.SheetNames[1];
  const wsC = cName ? wb.Sheets[cName] : null;
  const challenge = [];
  if (wsC) {
    for (const r of XLSX.utils.sheet_to_json(wsC, { defval: '' })) {
      const cq = String(r['Challenge Question'] || '').trim();
      const lessonId = String(r.lesson_id || '').trim();
      if (cq && lessonId) {
        challenge.push({ lesson_id: lessonId, question: cq, answer: String(r['Challenge Answer'] || '').trim() });
      }
    }
  }

  return { questions, challenge, topics: [...topics], fileOrderByTopic };
}

// Assign fresh unique q#### ids to any questions missing one (or colliding),
// keeping ids already present in `reserved` and within the batch.
export function assignIds(questions, reserved = []) {
  const used = new Set(reserved);
  for (const q of questions) if (q.id) used.add(q.id);
  let counter = 0;
  const fresh = () => {
    let id;
    do { counter += 1; id = `q${String(counter).padStart(4, '0')}`; } while (used.has(id));
    used.add(id);
    return id;
  };
  const emitted = new Set();
  return questions.map(q => {
    let id = q.id;
    if (!id || emitted.has(id)) id = fresh();
    emitted.add(id);
    return { ...q, id };
  });
}

// Build an .xlsx (Questions + Challenge+) and trigger a download.
export function buildQuestionWorkbook(questions, challenge, filename) {
  const wb = XLSX.utils.book_new();

  const qRows = questions.map(q => ({
    id: q.id,
    lesson_id: q.lesson_id,
    Lesson: q.lesson_title,
    Question: q.question,
    Answer: q.answer,
    Scaffold: q.scaffolded || '',
  }));
  const wsQ = XLSX.utils.json_to_sheet(qRows, { header: ['id', 'lesson_id', 'Lesson', 'Question', 'Answer', 'Scaffold'] });
  wsQ['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 60 }, { wch: 45 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, wsQ, 'Questions');

  const cMap = new Map(challenge.map(c => [c.lesson_id, c]));
  const cRows = LESSONS.map(l => {
    const ex = cMap.get(l.lesson_id);
    return {
      lesson_id: l.lesson_id,
      Lesson: l.lesson_title,
      'Challenge Question': ex?.question || '',
      'Challenge Answer': ex?.answer || '',
    };
  });
  const wsC = XLSX.utils.json_to_sheet(cRows, { header: ['lesson_id', 'Lesson', 'Challenge Question', 'Challenge Answer'] });
  wsC['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 70 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsC, 'Challenge+');

  XLSX.writeFile(wb, filename);
}

// Compare the file's lesson order against the natural (alphabetical) lesson_id
// order for each topic. Returns the topics whose order differs.
export function diffLessonOrder(fileOrderByTopic) {
  const diffs = [];
  for (const [topic, fileOrder] of fileOrderByTopic.entries()) {
    if (fileOrder.length < 2) continue;
    const natural = [...fileOrder].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (fileOrder.join('|') !== natural.join('|')) {
      diffs.push({
        topic,
        fileOrder: fileOrder.map(id => ({ id, title: lessonMetaById.get(id)?.lesson_title || id })),
        naturalOrder: natural.map(id => ({ id, title: lessonMetaById.get(id)?.lesson_title || id })),
      });
    }
  }
  return diffs;
}

// Produce new rota entries that reorder lessons WITHIN each affected topic block
// to match the file order, keeping every topic block in its current position.
export function reorderRotasByFileOrder(activeRotas, fileOrderByTopic) {
  const topicOf = id => lessonMetaById.get(id)?.topic_name || 'Unknown';
  const rotaIds = [...new Set(activeRotas.map(r => r.rota_id))];
  const result = [];

  for (const rotaId of rotaIds) {
    const entries = activeRotas.filter(r => r.rota_id === rotaId).sort((a, b) => a.lesson_order - b.lesson_order);
    const rotaName = entries[0]?.rota_name || rotaId;

    // Contiguous topic blocks
    const blocks = [];
    let cur = null;
    for (const e of entries) {
      const t = topicOf(e.lesson_id);
      if (!cur || cur.topic !== t) { cur = { topic: t, lessons: [] }; blocks.push(cur); }
      cur.lessons.push(e.lesson_id);
    }

    // Reorder lessons inside blocks whose topic is in the file
    for (const b of blocks) {
      const fileOrder = fileOrderByTopic.get(b.topic);
      if (!fileOrder) continue;
      const rank = new Map(fileOrder.map((id, i) => [id, i]));
      b.lessons.sort((a, c) => {
        const ra = rank.has(a) ? rank.get(a) : Infinity;
        const rc = rank.has(c) ? rank.get(c) : Infinity;
        return ra - rc;
      });
    }

    // Flatten to 1..N
    let order = 1;
    for (const b of blocks) {
      for (const lessonId of b.lessons) {
        result.push({ rota_id: rotaId, rota_name: rotaName, lesson_id: lessonId, lesson_order: order });
        order += 1;
      }
    }
  }
  return result;
}
