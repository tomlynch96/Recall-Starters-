import { useState, useMemo, useRef } from 'react';
import { getRawRotas, getActiveQuestions, getHiddenLessons, saveHiddenLessons, saveCustomRotas } from '../utils/storage.js';
import { LESSONS } from '../data/staticData.js';

const TOPIC_DOT = [
  'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-amber-400', 'bg-rose-400',
  'bg-teal-400', 'bg-indigo-400', 'bg-orange-400', 'bg-cyan-400', 'bg-lime-400',
  'bg-fuchsia-400', 'bg-emerald-400', 'bg-sky-400', 'bg-violet-400',
];

function renderScaffold(scaffold) {
  if (!scaffold) return <span className="text-gray-300 italic">no scaffold</span>;
  return scaffold.split(/(\[[^\]]+\])/).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (m) return <span key={i} className="text-blue-600 underline decoration-dotted font-medium">{m[1]}</span>;
    return <span key={i}>{part}</span>;
  });
}

export default function QuestionPreview() {
  const lessonMeta = useMemo(() => new Map(LESSONS.map(l => [l.lesson_id, l])), []);
  const topicOf = id => lessonMeta.get(id)?.topic_name || 'Unknown';

  const topicColour = useMemo(() => {
    const map = new Map();
    for (const l of LESSONS) if (!map.has(l.topic_name)) map.set(l.topic_name, TOPIC_DOT[map.size % TOPIC_DOT.length]);
    return t => map.get(t) || 'bg-gray-300';
  }, []);

  // Question counts per lesson (unaffected by hide/order)
  const byLesson = useMemo(() => {
    const m = new Map();
    for (const q of getActiveQuestions()) {
      if (!m.has(q.lesson_id)) m.set(q.lesson_id, []);
      m.get(q.lesson_id).push(q);
    }
    return m;
  }, []);

  const [raw, setRaw] = useState(() => getRawRotas());
  const [hidden, setHidden] = useState(() => new Set(getHiddenLessons()));
  const [selectedId, setSelectedId] = useState(null);
  const dragRef = useRef(null); // { lessonId, topic }

  const rotaIds = useMemo(() => [...new Set(raw.map(r => r.rota_id))], [raw]);
  const [rotaId, setRotaId] = useState(rotaIds[0]);
  const rotaName = (raw.find(r => r.rota_id === rotaId) || {}).rota_name || rotaId;

  // Ordered lessons for the selected rota (raw order, incl. hidden)
  const ordered = useMemo(() => {
    return raw
      .filter(r => r.rota_id === rotaId)
      .sort((a, b) => a.lesson_order - b.lesson_order)
      .map((r, i) => {
        const meta = lessonMeta.get(r.lesson_id);
        return {
          lesson_id: r.lesson_id,
          pos: i + 1,
          topic: meta?.topic_name || 'Unknown',
          title: meta?.lesson_title || r.lesson_id,
          number: meta?.lesson_number || '',
          count: (byLesson.get(r.lesson_id) || []).length,
          hidden: hidden.has(r.lesson_id),
        };
      });
  }, [raw, rotaId, hidden, lessonMeta, byLesson]);

  const selected = ordered.find(l => l.lesson_id === selectedId) || ordered[0] || null;
  const selectedQuestions = selected ? (byLesson.get(selected.lesson_id) || []) : [];
  const hiddenCount = ordered.filter(l => l.hidden).length;

  // ── Reorder a lesson within its topic block (selected rota only) ──
  function reorder(dragId, dropId) {
    if (dragId === dropId) return;
    const rotaEntries = raw.filter(e => e.rota_id === rotaId).sort((a, b) => a.lesson_order - b.lesson_order);
    const name = rotaEntries[0]?.rota_name || rotaId;
    // contiguous topic blocks
    const blocks = [];
    let cur = null;
    for (const e of rotaEntries) {
      const t = topicOf(e.lesson_id);
      if (!cur || cur.topic !== t) { cur = { topic: t, ids: [] }; blocks.push(cur); }
      cur.ids.push(e.lesson_id);
    }
    const blk = blocks.find(b => b.ids.includes(dragId));
    if (!blk || !blk.ids.includes(dropId)) return; // only reorder within the same topic
    const from = blk.ids.indexOf(dragId);
    blk.ids.splice(from, 1);
    blk.ids.splice(blk.ids.indexOf(dropId), 0, dragId);

    let order = 1;
    const rebuilt = [];
    for (const b of blocks) for (const id of b.ids) rebuilt.push({ rota_id: rotaId, rota_name: name, lesson_id: id, lesson_order: order++ });
    const next = [...raw.filter(e => e.rota_id !== rotaId), ...rebuilt];
    setRaw(next);
    saveCustomRotas(next);
  }

  function toggleHidden(id) {
    const set = new Set(hidden);
    if (set.has(id)) set.delete(id); else set.add(id);
    setHidden(set);
    saveHiddenLessons([...set]);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <label className="text-sm text-gray-500">Rota:</label>
        <select
          value={rotaId}
          onChange={e => { setRotaId(e.target.value); setSelectedId(null); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:border-blue-500"
        >
          {rotaIds.map(id => (
            <option key={id} value={id}>{(raw.find(r => r.rota_id === id) || {}).rota_name || id}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          {ordered.length - hiddenCount} taught · {hiddenCount} skipped
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Drag a lesson to reorder it within its topic for <span className="font-medium text-gray-500">{rotaName}</span>. Use the eye toggle to skip a lesson — skipped lessons are removed from <span className="italic">every</span> rota.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Left: ordered, draggable lesson list */}
        <div className="border-r border-gray-100 max-h-[70vh] overflow-y-auto">
          {ordered.map((l, i) => {
            const showTopic = i === 0 || ordered[i - 1].topic !== l.topic;
            const isSel = selected && l.lesson_id === selected.lesson_id;
            return (
              <div key={`${l.lesson_id}-${l.pos}`}>
                {showTopic && (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1 bg-white">
                    <span className={`w-2.5 h-2.5 rounded-full ${topicColour(l.topic)}`} />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{l.topic}</span>
                  </div>
                )}
                <div
                  draggable={!l.hidden}
                  onDragStart={() => { dragRef.current = { lessonId: l.lesson_id, topic: l.topic }; }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const d = dragRef.current; if (d) reorder(d.lessonId, l.lesson_id); dragRef.current = null; }}
                  className={`group flex items-center gap-2 px-3 py-2 border-l-4 transition-colors ${
                    isSel ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'
                  } ${l.hidden ? 'opacity-50' : ''}`}
                >
                  <span className={`text-gray-300 select-none leading-none ${l.hidden ? 'invisible' : 'cursor-grab group-hover:text-gray-500'}`} title="Drag to reorder">⠿</span>
                  <button onClick={() => setSelectedId(l.lesson_id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <span className="text-xs font-mono text-gray-400 w-6 shrink-0">{l.hidden ? '–' : l.pos}</span>
                    <span className={`flex-1 text-sm truncate ${l.hidden ? 'line-through text-gray-400' : isSel ? 'text-blue-800 font-semibold' : 'text-gray-700'}`}>
                      {l.number && l.number !== 'Assessment' ? `L${l.number} · ` : ''}{l.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-500">{l.count}</span>
                  </button>
                  <button
                    onClick={() => toggleHidden(l.lesson_id)}
                    title={l.hidden ? 'Un-skip: include this lesson in rotas' : 'Skip: remove this lesson from all rotas'}
                    className={`shrink-0 text-base leading-none px-1 transition-colors ${l.hidden ? 'text-gray-400 hover:text-blue-600' : 'text-gray-300 hover:text-red-500'}`}
                  >
                    {l.hidden ? '🚫' : '👁'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: questions for the selected lesson */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {!selected ? (
            <p className="text-gray-400 text-sm">No lessons in this rota.</p>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${topicColour(selected.topic)}`} />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{selected.topic}</span>
                  {selected.hidden && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Skipped</span>}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-1">
                  {selected.number && selected.number !== 'Assessment' ? `Lesson ${selected.number}: ` : ''}{selected.title}
                </h3>
                <p className="text-xs text-gray-400">
                  {selected.hidden ? 'Not taught (skipped in every rota)' : `Position ${selected.pos} in ${rotaName}`} · {selectedQuestions.length} question{selectedQuestions.length !== 1 ? 's' : ''}
                </p>
              </div>

              {selectedQuestions.length === 0 ? (
                <p className="text-sm text-gray-400 italic">This lesson has no questions in the current bank.</p>
              ) : (
                <ol className="space-y-3">
                  {selectedQuestions.map((q, i) => (
                    <li key={q.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex gap-2">
                        <span className="text-sm font-bold text-gray-400">{i + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800">{q.question}</p>
                          <p className="text-sm text-green-700 mt-1">{q.answer}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            <span className="text-gray-400">Scaffold: </span>{renderScaffold(q.scaffolded)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
