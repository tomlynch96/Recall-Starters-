/**
 * Seeds static reference data (questions, lessons, rotas, challenge_plus)
 * into Supabase. Run once after creating the schema.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment
 * (or a .env.local file) — NOT the anon key, which lacks insert access.
 *
 * Usage:
 *   node scripts/parseExcel.js          # regenerate staticData.js first
 *   node scripts/seedSupabase.js
 *
 * Safe to re-run: uses upsert, so existing rows are updated not duplicated.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local if present (no external dotenv dep needed)
const envPath = join(__dirname, '..', '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env.local not required — env vars may be set externally
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('Add them to .env.local or export them before running.');
  process.exit(1);
}

const supabase = createClient(url, key);

const STATIC_PATH = join(__dirname, '..', 'src', 'data', 'staticData.js');
const { QUESTIONS, LESSONS, ROTAS, CHALLENGE_PLUS } = await import(STATIC_PATH);

const CHUNK = 500; // batch size for upserts

async function upsert(table, rows, conflictCol) {
  if (!rows.length) { console.log(`  ${table}: 0 rows — skipped`); return; }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflictCol });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length} rows upserted`);
}

console.log('Seeding Supabase…');

await upsert('lessons', LESSONS.map(l => ({
  lesson_id:     l.lesson_id,
  topic_id:      l.topic_id,
  topic_name:    l.topic_name,
  lesson_number: l.lesson_number,
  lesson_title:  l.lesson_title,
})), 'lesson_id');

await upsert('questions', QUESTIONS.map(q => ({
  id:            q.id,
  lesson_id:     q.lesson_id,
  topic_id:      q.topic_id,
  topic_name:    q.topic_name,
  lesson_number: q.lesson_number,
  lesson_title:  q.lesson_title,
  question:      q.question,
  answer:        q.answer,
  scaffolded:    q.scaffolded,
})), 'id');

await upsert('rotas', ROTAS.map(r => ({
  rota_id:      r.rota_id,
  rota_name:    r.rota_name,
  lesson_id:    r.lesson_id,
  lesson_order: r.lesson_order,
})), 'rota_id,lesson_order');

if (CHALLENGE_PLUS.length) {
  await upsert('challenge_plus', CHALLENGE_PLUS.map(c => ({
    lesson_id: c.lesson_id,
    question:  c.question,
    answer:    c.answer || null,
  })), 'lesson_id');
} else {
  console.log('  challenge_plus: 0 rows — skipped (add questions to spreadsheet first)');
}

console.log('Done.');
