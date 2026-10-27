import { useEffect, useState } from 'react';
import { getActiveQuestions, withMyEdits, saveMyEdit, removeMyEdit } from '../utils/storage.js';
import { getLessonMeta, lessonLabel, topicColour } from '../utils/topicColours.js';
import EditableText from './EditableText.jsx';

function renderScaffold(scaffold) {
  if (!scaffold) return <span className="text-gray-300 italic">no scaffold</span>;
  return scaffold.split(/(\[[^\]]+\])/).map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (m) return <span key={i} className="text-blue-600 underline decoration-dotted font-medium">{m[1]}</span>;
    return <span key={i}>{part}</span>;
  });
}

// Slide-over showing one lesson's questions. Browsing never records anything.
// Teachers can edit any question: the edit becomes their own version (used
// whenever they teach it) and is sent to the HoD as a suggestion.
export default function LessonDrawer({ lessonId, email, status, onClose, onPlan, planLabel = 'Teach this next' }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta = getLessonMeta(lessonId);
  const topic = meta?.topic_name || '';
  const originals = getActiveQuestions().filter(q => q.lesson_id === lessonId);
  const questions = withMyEdits(originals, email);

  function edit(original, field, value) {
    saveMyEdit(email, original, field, value);
    setTick(t => t + 1);
  }

  function revert(questionId) {
    removeMyEdit(email, questionId);
    setTick(t => t + 1);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${topicColour(topic).dot}`} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{topic}</span>
            <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-700 text-2xl leading-none" title="Close">×</button>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mt-1">{lessonLabel(lessonId)}</h2>
          {status && <p className="text-xs text-gray-500 mt-1">{status}</p>}
          <p className="text-xs text-gray-400 mt-1">
            Browsing only — nothing here is recorded. Click any text to make your own version; it's also sent to your HoD as a suggestion.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {questions.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No questions for this lesson yet.</p>
          ) : (
            <ol className="space-y-3">
              {questions.map((q, i) => {
                const original = originals[i];
                return (
                  <li key={q.id} className={`border rounded-xl p-4 ${q.my_edit ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                    <div className="flex gap-2">
                      <span className="text-sm font-bold text-gray-400">{i + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-sm font-semibold text-gray-800">
                          <EditableText value={q.question} onSave={v => edit(original, 'question', v)} placeholder="question" />
                        </div>
                        <div className="text-sm text-green-700">
                          <span className="text-gray-400 text-xs mr-1">A:</span>
                          <EditableText value={q.answer} onSave={v => edit(original, 'answer', v)} placeholder="answer" inputClass="text-green-800" />
                        </div>
                        <p className="text-xs text-gray-500 pt-1">
                          <span className="text-gray-400">Scaffold: </span>
                          <EditableText
                            value={q.scaffolded || ''}
                            onSave={v => edit(original, 'scaffolded', v)}
                            placeholder="no scaffold"
                            allowEmpty
                            renderView={renderScaffold(q.scaffolded)}
                          />
                        </p>
                        {q.my_edit && (
                          <div className="flex items-center gap-3 pt-1 text-xs">
                            <span className="text-blue-700 font-medium">Your version · suggested to HoD</span>
                            <button onClick={() => revert(q.id)} className="text-gray-400 hover:text-red-500 underline">
                              Revert to original
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {onPlan && (
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={onPlan}
              className="w-full py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800"
            >
              {planLabel}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
