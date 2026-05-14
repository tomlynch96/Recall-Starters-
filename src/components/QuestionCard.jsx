import { useState } from 'react';

export default function QuestionCard({ question, index, onFlag, onSwap, onRemove }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      className={`relative bg-gray-900 rounded-xl p-5 cursor-pointer select-none border-2 transition-colors ${
        question.flagged ? 'border-amber-500' : 'border-gray-700 hover:border-blue-500'
      }`}
      onClick={() => setRevealed(r => !r)}
    >
      <div className="absolute top-2 right-2 flex gap-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onFlag(question)}
          title="Flag question"
          className={`text-sm px-1.5 py-0.5 rounded hover:bg-gray-700 ${question.flagged ? 'text-amber-400' : 'text-gray-400'}`}
        >
          🚩
        </button>
        <button
          onClick={() => onSwap(question, index)}
          title="Swap question"
          className="text-sm px-1.5 py-0.5 rounded hover:bg-gray-700 text-gray-400"
        >
          🔄
        </button>
        <button
          onClick={() => onRemove(question, index)}
          title="Remove question"
          className="text-sm px-1.5 py-0.5 rounded hover:bg-gray-700 text-gray-400"
        >
          ✕
        </button>
      </div>

      <div className="pr-20">
        <span className="text-blue-400 font-bold text-sm mr-2">{index + 1}.</span>
        <span className="text-white text-lg font-medium leading-snug">{question.question}</span>
      </div>

      {revealed && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <p className="text-green-300 text-base">{question.answer}</p>
        </div>
      )}

      {!revealed && (
        <p className="mt-2 text-gray-500 text-xs">Tap to reveal answer</p>
      )}

      {question.flagged && (
        <span className="absolute bottom-2 left-3 text-amber-400 text-xs">Flagged for review</span>
      )}
    </div>
  );
}
