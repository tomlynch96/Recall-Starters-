import { useState } from 'react';

export default function QuestionCard({ question, index, onFlag, onSwap, onRemove }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className={`group relative rounded-2xl p-5 cursor-pointer select-none transition-all ${
        question.flagged
          ? 'bg-amber-100 ring-2 ring-amber-400'
          : 'bg-orange-100 hover:bg-orange-50'
      }`}
      onClick={() => setRevealed(r => !r)}
    >
      {/* Control buttons — hidden until card is hovered */}
      <div
        className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onFlag(question)}
          title="Flag question"
          className={`text-base px-1.5 py-0.5 rounded hover:bg-orange-200 transition-colors ${
            question.flagged ? 'opacity-100' : 'opacity-60 hover:opacity-100'
          }`}
        >
          🚩
        </button>
        <button
          onClick={() => onSwap(question, index)}
          title="Swap question"
          className="text-base px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-orange-200 transition-colors"
        >
          🔄
        </button>
        <button
          onClick={() => onRemove(question, index)}
          title="Remove question"
          className="text-sm px-1.5 py-0.5 rounded opacity-60 hover:opacity-100 hover:bg-orange-200 text-gray-600 transition-colors font-bold"
        >
          ✕
        </button>
      </div>

      <p className="text-gray-900 text-lg font-medium leading-snug pr-16">
        <span className="font-bold mr-1">{index + 1})</span>
        {question.question}
      </p>

      {revealed ? (
        <p className="mt-3 pt-3 border-t border-orange-200 text-green-800 text-base font-medium">
          {question.answer}
        </p>
      ) : (
        <p className="mt-2 text-orange-300 text-xs">click to reveal</p>
      )}

      {question.flagged && (
        <span className="absolute bottom-2 left-4 text-amber-600 text-xs font-medium">⚑ flagged</span>
      )}
    </div>
  );
}
