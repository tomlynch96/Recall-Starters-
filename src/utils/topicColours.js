import { LESSONS } from '../data/staticData.js';

const PALETTE = [
  { chip: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-400' },
  { chip: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-400' },
  { chip: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-400' },
  { chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-400' },
  { chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-400' },
  { chip: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-400' },
  { chip: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-400' },
  { chip: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-400' },
  { chip: 'bg-cyan-100 text-cyan-800 border-cyan-200', dot: 'bg-cyan-400' },
  { chip: 'bg-lime-100 text-lime-800 border-lime-200', dot: 'bg-lime-400' },
  { chip: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200', dot: 'bg-fuchsia-400' },
  { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-400' },
  { chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-400' },
  { chip: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-400' },
];

const byTopic = new Map();
for (const l of LESSONS) {
  if (!byTopic.has(l.topic_name)) byTopic.set(l.topic_name, PALETTE[byTopic.size % PALETTE.length]);
}
const lessonById = new Map(LESSONS.map(l => [l.lesson_id, l]));

// Stable colours per topic, so a topic looks the same on every page
export function topicColour(topicName) {
  return byTopic.get(topicName) || { chip: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-300' };
}

export function getLessonMeta(lessonId) {
  return lessonById.get(lessonId) || null;
}

// "L3 · Tissues" / "Assessment · …"
export function lessonLabel(lessonId) {
  const l = lessonById.get(lessonId);
  if (!l) return lessonId || '';
  const num = l.lesson_number && l.lesson_number !== 'Assessment' ? `L${l.lesson_number}` : 'Assessment';
  return `${num} · ${l.lesson_title}`;
}
