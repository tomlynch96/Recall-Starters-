import { useState } from 'react';
import { useFitText } from '../utils/useFitText.js';

// Render a bracket-format scaffold: [word] hidden as _____ until revealed, then shown in colour
function renderScaffold(scaffold, revealed) {
  const parts = scaffold.split(/(\[[^\]]+\])/);
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]$/);
    if (!m) return <span key={i}>{part}</span>;
    const word = m[1];
    if (revealed) {
      return <span key={i} className="text-orange-500 font-bold">{word}</span>;
    }
    const blanks = '_'.repeat(Math.min(Math.max(word.replace(/\s/g, '').length, 4), 10));
    return <span key={i} className="text-gray-400 font-mono">{blanks}</span>;
  });
}

export default function QuestionCard({ question, index, onFlag, onSwap, onRemove, scaffoldAll, revealAll }) {
  const [revealed, setRevealed] = useState(false);
  const [localScaffold, setLocalScaffold] = useState(false);

  const showScaffold = scaffoldAll || localScaffold;
  const scaffold = question.scaffolded || `${question.question}: _____.`;
  const isRevealed = revealed || revealAll;

  // If the scaffold text has no [brackets], treat it as a hint rather than a fill-in scaffold
  const isHint = !scaffold.includes('[');

  // Shrink content to fit the card whenever the visible content changes
  const [fitRef, scale] = useFitText([question.id, isRevealed, showScaffold, scaffold]);

  return (
    <div
      className={`group relative h-full rounded-2xl px-6 py-4 cursor-pointer select-none transition-all flex flex-col ${
        question.flagged
          ? 'bg-amber-100 ring-2 ring-amber-400'
          : 'bg-orange-100 hover:bg-orange-50'
      }`}
      onClick={() => setRevealed(r => !r)}
    >
      {/* Hover controls */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => { setLocalScaffold(s => !s); setRevealed(false); }}
          title={localScaffold ? 'Show full question' : 'Scaffold this question'}
          className={`text-sm px-2 py-1 rounded-lg hover:bg-orange-200 transition-colors font-mono ${
            localScaffold ? 'text-blue-600 opacity-100' : 'opacity-50 hover:opacity-100 text-gray-600'
          }`}
        >
          _ _
        </button>
        <button
          onClick={() => onFlag(question)}
          title="Flag"
          className={`text-xl px-2 py-1 rounded-lg hover:bg-orange-200 transition-colors ${
            question.flagged ? '' : 'opacity-50 hover:opacity-100'
          }`}
        >
          🚩
        </button>
        <button
          onClick={() => onSwap(question, index)}
          title="Swap"
          className="text-xl px-2 py-1 rounded-lg opacity-50 hover:opacity-100 hover:bg-orange-200 transition-colors"
        >
          🔄
        </button>
        <button
          onClick={() => onRemove(question, index)}
          title="Remove"
          className="text-lg px-2 py-1 rounded-lg opacity-50 hover:opacity-100 hover:bg-orange-200 text-gray-600 font-bold transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Content — fixed-height box; font scales down until everything fits */}
      <div
        ref={fitRef}
        className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center"
        style={{ fontSize: `${1.875 * scale}rem` }}
      >
        {showScaffold && !isHint ? (
          // Bracket-format scaffold: blanks revealed on click
          <p className="text-gray-900 font-semibold leading-snug pr-16">
            <span className="font-bold mr-2">{index + 1})</span>
            {renderScaffold(scaffold, isRevealed)}
          </p>
        ) : (
          <>
            {/* Question */}
            <p className="text-gray-900 font-semibold leading-snug pr-16">
              <span className="font-bold mr-2">{index + 1})</span>
              {question.question}
            </p>
            {/* Hint (shown when scaffold pressed and no brackets in scaffold text) */}
            {showScaffold && isHint && !isRevealed && (
              <p className="mt-2 pt-2 border-t-2 border-orange-200 text-gray-500 font-medium" style={{ fontSize: '0.8em' }}>
                Hint: <span className="italic">{scaffold}</span>
              </p>
            )}
            {/* Answer */}
            {isRevealed && (
              <p className="mt-2 pt-2 border-t-2 border-orange-200 text-green-800 font-medium" style={{ fontSize: '0.8em' }}>
                {question.answer}
              </p>
            )}
          </>
        )}
      </div>

      {question.flagged && (
        <span className="absolute bottom-3 left-5 text-amber-600 text-sm font-semibold">⚑ flagged</span>
      )}
    </div>
  );
}
