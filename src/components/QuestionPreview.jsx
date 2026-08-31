import { useState, useMemo } from 'react';
import { getActiveRotas, getActiveQuestions } from '../utils/storage.js';
import { LESSONS } from '../data/staticData.js';

const TOPIC_DOT = [
  'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-amber-400', 'bg-rose-400',
  'bg-teal-400', 'bg-indigo-400', 'bg-orange-400', 'bg-cyan-400', 'bg-lime-400',
  'bg-fuchsia-400', 'bg-emerald-400', 'bg-sky-400', 'bg-violet-400',
];

// Render a [bracket] scaffold with the gap words underlined so the HoD can see
// what pupils fill in.
function renderScaffold(scaffold) {
  if (!scaffold) return <span className="text-gray-300 italic">no scaffold</span>;
  return scaffold.split(/(\[[^\]]+\])/).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (m) return <span key={i} className="text-blue-600 underline decoration-dotted font-medium">{m[1]}</span>;
    return <span key={i}>{part}</span>;
  });
}

export default function QuestionPreview() {
  const rotas = getActiveRotas();
  const rotaIds = useMemo(() => [...new Set(rotas.map(r => r.rota_id))], [rotas]);
  const [rotaId, setRotaId] = useState(rotaIds[0]);

  const lessonMeta = useMemo(() => new Map(LESSONS.map(l => [l.lesson_id, l])), []);

  // Stable topic → colour dot
  const topicColour = useMemo(() => {
    const map = new Map();
    for (const l of LESSONS) if (!map.has(l.topic_name)) map.set(l.topic_name, TOPIC_DOT[map.size % TOPIC_DOT.length]);
    return t => map.get(t) || 'bg-gray-300';
  }, []);

  // Questions grouped by lesson_id
  const byLesson = useMemo(() => {
    const m = new Map();
    for (const q of getActiveQuestions()) {
      if (!m.has(q.lesson_id)) m.set(q.lesson_id, []);
      m.get(q.lesson_id).push(q);
    }
    return m;
  }, []);

  // Ordered lessons for the selected rota
  const orderedLessons = useMemo(() => {
    return rotas
      .filter(r => r.rota_id === rotaId)
      .sort((a, b) => a.lesson_order - b.lesson_order)
      .map(r => {
        const meta = lessonMeta.get(r.lesson_id);
        return {
          lesson_id: r.lesson_id,
          order: r.lesson_order,
          topic: meta?.topic_name || 'Unknown',
          title: meta?.lesson_title || r.lesson_id,
          number: meta?.lesson_number || '',
          count: (byLesson.get(r.lesson_id) || []).length,
        };
      });
  }, [rotas, rotaId, lessonMeta, byLesson]);

  const rotaName = (rotas.find(r => r.rota_id === rotaId) || {}).rota_name || rotaId;

  const [selectedId, setSelectedId] = useState(orderedLessons[0]?.lesson_id || null);
  // Keep selection valid when switching rota
  const selected = orderedLessons.find(l => l.lesson_id === selectedId) || orderedLessons[0] || null;
  const selectedQuestions = selected ? (byLesson.get(selected.lesson_id) || []) : [];

  const totalQuestions = orderedLessons.reduce((n, l) => n + l.count, 0);

  return (
    <div>
      {/* Rota selector + summary */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="text-sm text-gray-500">Rota:</label>
        <select
          value={rotaId}
          onChange={e => { setRotaId(e.target.value); setSelectedId(null); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:border-blue-500"
        >
          {rotaIds.map(id => (
            <option key={id} value={id}>{(rotas.find(r => r.rota_id === id) || {}).rota_name || id}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{orderedLessons.length} lessons · {totalQuestions} questions</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Left: ordered lesson list, topic-grouped */}
        <div className="border-r border-gray-100 max-h-[70vh] overflow-y-auto">
          {orderedLessons.map((l, i) => {
            const showTopic = i === 0 || orderedLessons[i - 1].topic !== l.topic;
            const isSel = selected && l.lesson_id === selected.lesson_id;
            return (
              <div key={`${l.lesson_id}-${l.order}`}>
                {showTopic && (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1 sticky top-0 bg-white">
                    <span className={`w-2.5 h-2.5 rounded-full ${topicColour(l.topic)}`} />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{l.topic}</span>
                  </div>
                )}
                <button
                  onClick={() => setSelectedId(l.lesson_id)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${isSel ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent hover:bg-gray-50'}`}
                >
                  <span className="text-xs font-mono text-gray-400 w-8 shrink-0">{l.order}</span>
                  <span className={`flex-1 text-sm truncate ${isSel ? 'text-blue-800 font-semibold' : 'text-gray-700'}`}>
                    {l.number && l.number !== 'Assessment' ? `L${l.number} · ` : ''}{l.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${l.count === 0 ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{l.count}</span>
                </button>
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
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-1">
                  {selected.number && selected.number !== 'Assessment' ? `Lesson ${selected.number}: ` : ''}{selected.title}
                </h3>
                <p className="text-xs text-gray-400">Position {selected.order} in {rotaName} · {selectedQuestions.length} question{selectedQuestions.length !== 1 ? 's' : ''}</p>
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
