import { useState } from 'react';

export default function QuestionCard({ question, index, onFlag, onSwap, onRemove }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className={`group relative h-full rounded-2xl px-6 py-4 cursor-pointer select-none transition-all flex flex-col justify-center ${
        question.flagged
          ? 'bg-amber-100 ring-2 ring-amber-400'
          : 'bg-orange-100 hover:bg-orange-50'
      }`}
      onClick={() => setRevealed(r => !r)}
    >
      {/* Buttons — invisible until hover */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
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

      <p className="text-gray-900 text-3xl font-semibold leading-snug pr-24">
        <span className="font-bold mr-2">{index + 1})</span>
        {question.question}
      </p>

      {revealed && (
        <p className="mt-3 pt-3 border-t-2 border-orange-200 text-green-800 text-2xl font-medium">
          {question.answer}
        </p>
      )}

      {question.flagged && (
        <span className="absolute bottom-3 left-5 text-amber-600 text-sm font-semibold">⚑ flagged</span>
      )}
    </div>
  );
}
