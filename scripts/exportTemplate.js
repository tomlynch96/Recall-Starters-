/**
 * Writes data/questions-template.xlsx — a ready-to-edit spreadsheet for the department.
 *
 * The 'questions' sheet includes a 'scaffold' column pre-filled with AI-generated sentences.
 * Teachers can edit any cell in that column; leaving it blank keeps the auto-generated version.
 *
 * Workflow:
 *   1. npm run export-template  →  generates data/questions-template.xlsx
 *   2. Open in Excel or import to Google Sheets
 *   3. Edit questions, answers, and scaffold sentences as needed
 *   4. Download as questions.xlsx and replace data/questions.xlsx
 *   5. npm run dev or npm run build  →  app updates automatically
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { utils, write } from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STATIC_PATH = join(__dirname, '..', 'src', 'data', 'staticData.js');
const SCAFFOLDS_PATH = join(__dirname, '..', 'data', 'scaffolds.json');
const OUT_PATH = join(__dirname, '..', 'data', 'questions-template.xlsx');

// Dynamically import the generated static data
const { QUESTIONS, LESSONS, ROTAS, CHALLENGE_PLUS = [] } = await import(STATIC_PATH);

const aiScaffolds = existsSync(SCAFFOLDS_PATH)
  ? JSON.parse(readFileSync(SCAFFOLDS_PATH, 'utf8'))
  : {};

// Questions sheet — include scaffold column so teachers can override
const questionRows = QUESTIONS.map(q => ({
  id: q.id,
  lesson_id: q.lesson_id,
  topic_id: q.topic_id,
  topic_name: q.topic_name,
  lesson_number: q.lesson_number,
  lesson_title: q.lesson_title,
  question: q.question,
  answer: q.answer,
  scaffold: aiScaffolds[q.id] || q.scaffolded || '',
}));

// challenge_plus sheet — one row per lesson, teachers fill in question + answer
const challengePlusRows = CHALLENGE_PLUS.length > 0
  ? CHALLENGE_PLUS.map(c => ({ lesson_id: c.lesson_id, question: c.question, answer: c.answer }))
  : [{ lesson_id: '', question: '', answer: '' }]; // placeholder row so the sheet has headers

const wb = utils.book_new();
utils.book_append_sheet(wb, utils.json_to_sheet(questionRows), 'questions');
utils.book_append_sheet(wb, utils.json_to_sheet(LESSONS), 'lessons');
utils.book_append_sheet(wb, utils.json_to_sheet(ROTAS), 'rotas');
utils.book_append_sheet(wb, utils.json_to_sheet(challengePlusRows), 'challenge_plus');

const buf = write(wb, { type: 'buffer', bookType: 'xlsx' });
writeFileSync(OUT_PATH, buf);
console.log(`Template written to ${OUT_PATH} (${questionRows.length} questions)`);
