import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { read, utils } from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const XLSX_PATH = join(DATA_DIR, 'questions.xlsx');
const LEGACY_XLSX_PATH = join(__dirname, '..', 'public', 'year7_recall_sheets_v3.xlsx');
const CSV_QUESTIONS_PATH = join(DATA_DIR, 'questions.csv');
const CSV_LESSONS_PATH = join(DATA_DIR, 'lessons.csv');
const CSV_ROTAS_PATH = join(DATA_DIR, 'rotas.csv');

// AI-written scaffold sentences (overrides auto-generation when present)
const SCAFFOLDS_PATH = join(__dirname, '..', 'data', 'scaffolds.json');
const OUT_PATH = join(__dirname, '..', 'src', 'data', 'staticData.js');

// Load hand-authored / AI-generated scaffolds from JSON
const aiScaffolds = existsSync(SCAFFOLDS_PATH)
  ? JSON.parse(readFileSync(SCAFFOLDS_PATH, 'utf8'))
  : {};

function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function generateScaffold(question, answer) {
  const q = question.trim().replace(/[?.!]+$/, '').trim();

  let m;

  // "Define 'X'" or "Define X"
  m = q.match(/^Define\s+['"]?(.+?)['"]?\.?$/i);
  if (m) return `${capitalise(m[1])} is _____.`;

  // "Describe what X means [in Y / context]"
  m = q.match(/^Describe what\s+(.+?)\s+means?\s*(in\s+.+)?$/i);
  if (m) {
    const ctx = m[2] ? ` ${m[2]}` : '';
    return `${capitalise(m[1])}${ctx} means _____.`;
  }

  // "Describe what X is"
  m = q.match(/^Describe what\s+(.+?)\s+is$/i);
  if (m) return `${capitalise(m[1])} is _____.`;

  // "Describe X"
  m = q.match(/^Describe\s+(.+)$/i);
  if (m) return `${capitalise(m[1])} is _____.`;

  // "What is the role/function/purpose/job/use of X?"
  m = q.match(/^What is the (role|function|purpose|job|use)\s+of\s+(.+)$/i);
  if (m) return `The ${m[1]} of ${m[2]} is _____.`;

  // "What does X mean?"
  m = q.match(/^What does\s+(.+?)\s+mean\??$/i);
  if (m) return `${capitalise(m[1])} means _____.`;

  // "What does X do?"
  m = q.match(/^What does\s+(.+?)\s+do\??$/i);
  if (m) return `${capitalise(m[1])} _____.`;

  // "What are X?"
  m = q.match(/^What are\s+(.+)$/i);
  if (m) return `${capitalise(m[1])} are _____.`;

  // "What is X?"
  m = q.match(/^What is\s+(.+)$/i);
  if (m) return `${capitalise(m[1])} is _____.`;

  // "Name the N X" (e.g. "Name the 3 key parts of...")
  m = q.match(/^Name\s+the\s+(\d+|two|three|four|five|six)\s+(.+)$/i);
  if (m) {
    const num = m[1].toLowerCase();
    const isPlural = ['two', 'three', 'four', 'five', 'six'].includes(num) || (parseInt(num) > 1);
    return `The ${m[1]} ${m[2]} ${isPlural ? 'are' : 'is'} _____.`;
  }

  // "Name a/an/the/two/three/N X"
  m = q.match(/^Name\s+(a|an|the|two|three|four|five|six|one|\d+)\s+(.+)$/i);
  if (m) {
    const num = m[1].toLowerCase();
    const isPlural = ['two', 'three', 'four', 'five', 'six'].includes(num) || (parseInt(num) > 1);
    return `${capitalise(m[1])} ${m[2]} ${isPlural ? 'are' : 'is'} _____.`;
  }

  // "Name X"
  m = q.match(/^Name\s+(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // "State X"
  m = q.match(/^State\s+(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // "Explain why/how X" or "Explain X"
  m = q.match(/^Explain\s+(?:why|how)?\s*(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // "How does X work?"
  m = q.match(/^How does\s+(.+?)\s+work\??$/i);
  if (m) return `${capitalise(m[1])} works by _____.`;

  // "How does X Y?"
  m = q.match(/^How does\s+(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // "Give two/three/N examples of X"
  m = q.match(/^Give\s+(?:two|three|four|five|some|\d+)\s+examples?\s+of\s+(.+)$/i);
  if (m) return `Examples of ${m[1]} include _____.`;

  // "Give an/one example of X"
  m = q.match(/^Give\s+(?:an?|one)\s+example\s+of\s+(.+)$/i);
  if (m) return `An example of ${m[1]} is _____.`;

  // "Give N properties of X"
  m = q.match(/^Give\s+(?:\d+|some|two|three|four|five)\s+propert(?:y|ies)\s+of\s+(.+)$/i);
  if (m) return `Properties of ${m[1]} include _____.`;

  // "Give N/some [plural noun] ..."  (ways, reasons, advantages, disadvantages, etc.)
  m = q.match(/^Give\s+(?:\d+|some|two|three|four|five)\s+(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // "Give the/a X" (e.g. "Give the unit for energy")
  m = q.match(/^Give\s+(?:the|a|an)\s+(.+)$/i);
  if (m) return `The ${m[1]} is _____.`;

  // "Give X" — catch-all
  m = q.match(/^Give\s+(.+)$/i);
  if (m) return `${capitalise(m[1])}: _____.`;

  // Fallback: question as statement with blank
  return `${capitalise(q)}: _____.`;
}

// Minimal RFC 4180-compatible CSV parser (no external deps)
function parseCsv(text) {
  const rows = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const row = [];
    while (i < n && text[i] !== '\n') {
      if (text[i] === '"') {
        let field = '';
        i++; // skip opening quote
        while (i < n) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') { field += '"'; i += 2; }
            else { i++; break; }
          } else {
            field += text[i++];
          }
        }
        row.push(field);
        if (text[i] === ',') i++;
      } else {
        let field = '';
        while (i < n && text[i] !== ',' && text[i] !== '\n') field += text[i++];
        row.push(field.replace(/\r$/, ''));
        if (text[i] === ',') i++;
      }
    }
    if (text[i] === '\n') i++;
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });
    return obj;
  });
}

function readCsvRows(path) {
  return existsSync(path) ? parseCsv(readFileSync(path, 'utf8')) : [];
}

function normaliseQuestionRows(rows, idPrefix = 'q') {
  return rows.map((row, i) => ({
    id: String(row['id'] || '').trim() || `${idPrefix}${String(i + 1).padStart(4, '0')}`,
    lesson_id: String(row['lesson_id'] || '').trim(),
    topic_id: String(row['topic_id'] || '').trim(),
    topic_name: String(row['topic_name'] || '').trim(),
    lesson_number: String(row['lesson_number'] ?? '').trim(),
    lesson_title: String(row['lesson_title'] || '').trim(),
    question: String(row['question'] || '').trim(),
    answer: String(row['answer'] || '').trim(),
    _excelScaffold: String(row['scaffold'] || '').trim(),
  })).filter(q => q.question);
}

function finishQuestions(rawQuestions) {
  const lessonCounts = {};
  return rawQuestions
    .filter(q => {
      lessonCounts[q.lesson_id] = (lessonCounts[q.lesson_id] || 0) + 1;
      return lessonCounts[q.lesson_id] <= 4;
    })
    .map(({ _excelScaffold, ...q }) => ({
      ...q,
      scaffolded: _excelScaffold || aiScaffolds[q.id] || generateScaffold(q.question, q.answer),
    }));
}

function parseExcel() {
  let questions, lessons, rotas;

  if (existsSync(XLSX_PATH)) {
    // Primary path: data/questions.xlsx
    const wb = read(readFileSync(XLSX_PATH), { type: 'buffer' });
    const sheet = name => wb.Sheets[name] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === name)];
    const qRows = sheet('questions') ? utils.sheet_to_json(sheet('questions')) : [];
    const lRows = sheet('lessons') ? utils.sheet_to_json(sheet('lessons')) : [];
    const rRows = sheet('rotas') ? utils.sheet_to_json(sheet('rotas')) : [];

    questions = finishQuestions(normaliseQuestionRows(qRows));
    lessons = lRows.map(row => ({
      lesson_id: String(row['lesson_id'] || '').trim(),
      topic_id: String(row['topic_id'] || '').trim(),
      topic_name: String(row['topic_name'] || '').trim(),
      lesson_number: String(row['lesson_number'] ?? '').trim(),
      lesson_title: String(row['lesson_title'] || '').trim(),
    })).filter(l => l.lesson_id);
    rotas = rRows.map(row => ({
      rota_id: String(row['rota_id'] || '').trim(),
      rota_name: String(row['rota_name'] || '').trim(),
      lesson_id: String(row['lesson_id'] || '').trim(),
      lesson_order: Number(row['lesson_order']),
    })).filter(r => r.rota_id && r.lesson_id);

  } else if (existsSync(CSV_QUESTIONS_PATH)) {
    // CSV fallback: data/questions.csv + data/lessons.csv + data/rotas.csv
    console.log('Using CSV source files from data/');
    questions = finishQuestions(normaliseQuestionRows(readCsvRows(CSV_QUESTIONS_PATH)));
    lessons = readCsvRows(CSV_LESSONS_PATH).map(row => ({
      lesson_id: String(row['lesson_id'] || '').trim(),
      topic_id: String(row['topic_id'] || '').trim(),
      topic_name: String(row['topic_name'] || '').trim(),
      lesson_number: String(row['lesson_number'] ?? '').trim(),
      lesson_title: String(row['lesson_title'] || '').trim(),
    })).filter(l => l.lesson_id);
    rotas = readCsvRows(CSV_ROTAS_PATH).map(row => ({
      rota_id: String(row['rota_id'] || '').trim(),
      rota_name: String(row['rota_name'] || '').trim(),
      lesson_id: String(row['lesson_id'] || '').trim(),
      lesson_order: Number(row['lesson_order']),
    })).filter(r => r.rota_id && r.lesson_id);

  } else if (existsSync(LEGACY_XLSX_PATH)) {
    // Legacy fallback: public/year7_recall_sheets_v3.xlsx
    console.warn('Falling back to legacy Excel file at', LEGACY_XLSX_PATH);
    const wb = read(readFileSync(LEGACY_XLSX_PATH), { type: 'buffer' });
    const sheet = name => wb.Sheets[name] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === name)];
    const qRows = sheet('questions') ? utils.sheet_to_json(sheet('questions')) : [];
    const lRows = sheet('lessons') ? utils.sheet_to_json(sheet('lessons')) : [];
    const rRows = sheet('rotas') ? utils.sheet_to_json(sheet('rotas')) : [];

    questions = finishQuestions(normaliseQuestionRows(qRows));
    lessons = lRows.map(row => ({
      lesson_id: String(row['lesson_id'] || '').trim(),
      topic_id: String(row['topic_id'] || '').trim(),
      topic_name: String(row['topic_name'] || '').trim(),
      lesson_number: String(row['lesson_number'] ?? '').trim(),
      lesson_title: String(row['lesson_title'] || '').trim(),
    })).filter(l => l.lesson_id);
    rotas = rRows.map(row => ({
      rota_id: String(row['rota_id'] || '').trim(),
      rota_name: String(row['rota_name'] || '').trim(),
      lesson_id: String(row['lesson_id'] || '').trim(),
      lesson_order: Number(row['lesson_order']),
    })).filter(r => r.rota_id && r.lesson_id);

  } else {
    console.warn('No data source found — writing empty arrays');
    writeFileSync(OUT_PATH, `export const QUESTIONS = [];\nexport const LESSONS = [];\nexport const ROTAS = [];\n`);
    return;
  }

  writeFileSync(OUT_PATH, `// Auto-generated by scripts/parseExcel.js — do not edit manually
export const QUESTIONS = ${JSON.stringify(questions, null, 2)};

export const LESSONS = ${JSON.stringify(lessons, null, 2)};

export const ROTAS = ${JSON.stringify(rotas, null, 2)};
`);
  console.log(`Parsed ${questions.length} questions, ${lessons.length} lessons, ${rotas.length} rota entries`);
}

parseExcel();
