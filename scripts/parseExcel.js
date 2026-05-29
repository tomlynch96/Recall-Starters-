import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { read, utils } from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source data: data/questions.xlsx (preferred) or legacy public/ location
const XLSX_PATH = existsSync(join(__dirname, '..', 'data', 'questions.xlsx'))
  ? join(__dirname, '..', 'data', 'questions.xlsx')
  : join(__dirname, '..', 'public', 'year7_recall_sheets_v3.xlsx');

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

function parseExcel() {
  if (!existsSync(XLSX_PATH)) {
    console.warn('Excel file not found at', XLSX_PATH, '— writing empty arrays');
    writeFileSync(OUT_PATH, `export const QUESTIONS = [];\nexport const LESSONS = [];\nexport const ROTAS = [];\n`);
    return;
  }

  const buf = readFileSync(XLSX_PATH);
  const wb = read(buf, { type: 'buffer' });

  // Parse questions sheet
  const qSheet = wb.Sheets['questions'] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'questions')];
  const lSheet = wb.Sheets['lessons'] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'lessons')];
  const rSheet = wb.Sheets['rotas'] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'rotas')];

  const rawQuestions = qSheet ? utils.sheet_to_json(qSheet).map(row => ({
    id: String(row['id'] || '').trim(),
    lesson_id: String(row['lesson_id'] || '').trim(),
    topic_id: String(row['topic_id'] || '').trim(),
    topic_name: String(row['topic_name'] || '').trim(),
    lesson_number: row['lesson_number'] !== undefined ? String(row['lesson_number']).trim() : '',
    lesson_title: String(row['lesson_title'] || '').trim(),
    question: String(row['question'] || '').trim(),
    answer: String(row['answer'] || '').trim(),
    // Optional column teachers can fill in — takes highest priority
    _excelScaffold: String(row['scaffold'] || '').trim(),
  })).filter(q => q.id && q.question) : [];

  // Clip to max 4 questions per lesson_id
  const lessonCounts = {};
  const questions = rawQuestions
    .filter(q => {
      lessonCounts[q.lesson_id] = (lessonCounts[q.lesson_id] || 0) + 1;
      return lessonCounts[q.lesson_id] <= 4;
    })
    .map(({ _excelScaffold, ...q }) => ({
      ...q,
      // Priority: Excel 'scaffold' column → data/scaffolds.json → regex auto-generate
      scaffolded: _excelScaffold || aiScaffolds[q.id] || generateScaffold(q.question, q.answer),
    }));

  const lessons = lSheet ? utils.sheet_to_json(lSheet).map(row => ({
    lesson_id: String(row['lesson_id'] || '').trim(),
    topic_id: String(row['topic_id'] || '').trim(),
    topic_name: String(row['topic_name'] || '').trim(),
    lesson_number: row['lesson_number'] !== undefined ? String(row['lesson_number']).trim() : '',
    lesson_title: String(row['lesson_title'] || '').trim(),
  })).filter(l => l.lesson_id) : [];

  const rotas = rSheet ? utils.sheet_to_json(rSheet).map(row => ({
    rota_id: String(row['rota_id'] || '').trim(),
    rota_name: String(row['rota_name'] || '').trim(),
    lesson_id: String(row['lesson_id'] || '').trim(),
    lesson_order: Number(row['lesson_order']),
  })).filter(r => r.rota_id && r.lesson_id) : [];

  const output = `// Auto-generated by scripts/parseExcel.js — do not edit manually
export const QUESTIONS = ${JSON.stringify(questions, null, 2)};

export const LESSONS = ${JSON.stringify(lessons, null, 2)};

export const ROTAS = ${JSON.stringify(rotas, null, 2)};
`;

  writeFileSync(OUT_PATH, output);
  console.log(`Parsed ${questions.length} questions, ${lessons.length} lessons, ${rotas.length} rota entries`);
}

parseExcel();
