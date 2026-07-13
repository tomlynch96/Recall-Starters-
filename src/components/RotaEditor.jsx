import { useState, useRef } from 'react';
import { ROTAS, LESSONS } from '../data/staticData.js';
import { getActiveRotas, saveCustomRotas, clearCustomRotas, getCustomRotas } from '../utils/storage.js';

const TOPIC_COLOURS = [
  'bg-blue-100 border-blue-300 text-blue-800',
  'bg-green-100 border-green-300 text-green-800',
  'bg-purple-100 border-purple-300 text-purple-800',
  'bg-amber-100 border-amber-300 text-amber-800',
  'bg-rose-100 border-rose-300 text-rose-800',
  'bg-teal-100 border-teal-300 text-teal-800',
  'bg-indigo-100 border-indigo-300 text-indigo-800',
  'bg-orange-100 border-orange-300 text-orange-800',
  'bg-cyan-100 border-cyan-300 text-cyan-800',
  'bg-lime-100 border-lime-300 text-lime-800',
  'bg-fuchsia-100 border-fuchsia-300 text-fuchsia-800',
  'bg-emerald-100 border-emerald-300 text-emerald-800',
  'bg-sky-100 border-sky-300 text-sky-800',
  'bg-violet-100 border-violet-300 text-violet-800',
];

// Stable colour per topic (by first-seen order across all lessons)
const topicColour = (() => {
  const map = new Map();
  for (const l of LESSONS) {
    if (!map.has(l.topic_name)) map.set(l.topic_name, TOPIC_COLOURS[map.size % TOPIC_COLOURS.length]);
  }
  return t => map.get(t) || 'bg-gray-100 border-gray-300 text-gray-700';
})();

const lessonTopic = (() => {
  const map = new Map(LESSONS.map(l => [l.lesson_id, l.topic_name]));
  return id => map.get(id) || 'Unknown';
})();

// Group one rota's entries into contiguous topic blocks (order preserved)
function buildBlocks(entries) {
  const sorted = [...entries].sort((a, b) => a.lesson_order - b.lesson_order);
  const blocks = [];
  let cur = null;
  for (const e of sorted) {
    const topic = lessonTopic(e.lesson_id);
    if (!cur || cur.topic !== topic) {
      cur = { topic, lessons: [] };
      blocks.push(cur);
    }
    cur.lessons.push(e.lesson_id);
  }
  return blocks;
}

// Flatten reordered blocks back into rota entries with fresh 1..N lesson_order
function blocksToEntries(rotaId, rotaName, blocks) {
  const entries = [];
  let order = 1;
  for (const b of blocks) {
    for (const lessonId of b.lessons) {
      entries.push({ rota_id: rotaId, rota_name: rotaName, lesson_id: lessonId, lesson_order: order });
      order += 1;
    }
  }
  return entries;
}

export default function RotaEditor() {
  // All active rota entries (custom override or bundled default)
  const [entries, setEntries] = useState(() => getActiveRotas());
  const [isCustom, setIsCustom] = useState(() => !!getCustomRotas());
  const [savedFlash, setSavedFlash] = useState(false);
  const dragRef = useRef(null); // { rotaId, index }

  // Preserve the bundled rota order for the column layout
  const rotaIds = [...new Set(ROTAS.map(r => r.rota_id))]
    .filter(id => entries.some(e => e.rota_id === id));
  const rotaName = id => (entries.find(e => e.rota_id === id) || ROTAS.find(r => r.rota_id === id))?.rota_name || id;

  function persist(nextEntries) {
    setEntries(nextEntries);
    saveCustomRotas(nextEntries);
    setIsCustom(true);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function reorder(rotaId, from, to) {
    if (from === to) return;
    const rotaEntries = entries.filter(e => e.rota_id === rotaId);
    const blocks = buildBlocks(rotaEntries);
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    const rebuilt = blocksToEntries(rotaId, rotaName(rotaId), blocks);
    const others = entries.filter(e => e.rota_id !== rotaId);
    persist([...others, ...rebuilt]);
  }

  function handleReset() {
    if (!window.confirm('Reset all rotas to the default sequencing? Any reordering you have saved will be discarded for everyone.')) return;
    clearCustomRotas();
    setEntries(ROTAS);
    setIsCustom(false);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-sm font-medium px-3 py-1 rounded-full ${isCustom ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
          {isCustom ? 'Custom rota order active' : 'Default rota order'}
        </span>
        {savedFlash && <span className="text-sm text-green-600">✓ Saved</span>}
        {isCustom && (
          <button
            onClick={handleReset}
            className="ml-auto text-sm text-gray-500 hover:text-red-500 border-2 border-gray-200 hover:border-red-300 rounded-xl px-4 py-1.5 font-semibold transition-colors"
          >
            Reset to default
          </button>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-6">
        Each column is one rota. Drag the topic cards to change the order topics are taught in. Changes save automatically and apply for every teacher on that rota.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rotaIds.map(rotaId => {
          const blocks = buildBlocks(entries.filter(e => e.rota_id === rotaId));
          return (
            <div key={rotaId} className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-700 text-sm mb-1">{rotaName(rotaId)}</h3>
              <p className="text-xs text-gray-400 mb-3">{blocks.length} topics · {blocks.reduce((n, b) => n + b.lessons.length, 0)} lessons</p>
              <div className="space-y-2">
                {blocks.map((block, i) => (
                  <div
                    key={`${block.topic}-${i}`}
                    draggable
                    onDragStart={() => { dragRef.current = { rotaId, index: i }; }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const d = dragRef.current;
                      if (d && d.rotaId === rotaId) reorder(rotaId, d.index, i);
                      dragRef.current = null;
                    }}
                    className={`group flex items-center gap-2 border rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${topicColour(block.topic)}`}
                  >
                    <span className="text-gray-400 group-hover:text-gray-600 select-none leading-none text-lg" title="Drag to reorder">⠿</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{i + 1}. {block.topic}</div>
                      <div className="text-xs opacity-70">{block.lessons.length} lesson{block.lessons.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
