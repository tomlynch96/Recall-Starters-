import { useState } from 'react';

// Fill in the blank(s) with the correct answer for display on reveal
function completeScaffold(scaffold, question, answer) {
  // "Define 'X'" questions: the blank is the TERM, not the full definition
  const defineMatch = question.match(/^Define\s+['"]?(.+?)['"]?\.?\s*$/i);
  if (defineMatch) {
    const term = defineMatch[1].trim();
    return scaffold.replace(/[A-Za-z]?_{2,}/g, term);
  }

  // All other questions: replace the whole blank cluster with the answer
  // Blank cluster: first-letter hints separated by spaces, commas, "and", "or"
  const BLANK_CLUSTER = /[A-Za-z]?_{2,}(?:[,\s]+(?:and\s+|or\s+)?[A-Za-z]?_{2,})*/;
  const blankIdx = scaffold.search(BLANK_CLUSTER);

  // Lowercase answer if the blank is mid-sentence
  let ans = answer;
  if (blankIdx > 0) {
    ans = ans.charAt(0).toLowerCase() + ans.slice(1);
    // Strip any leading portion of the answer that's already present in the scaffold
    // before the blank — handles cases like "...by strong t_____" + "By strong tendons"
    const contextWords = scaffold.slice(0, blankIdx).trim().toLowerCase().split(/\s+/);
    const ansLower = ans.toLowerCase();
    for (let i = contextWords.length; i >= 1; i--) {
      const prefix = contextWords.slice(-i).join(' ') + ' ';
      if (ansLower.startsWith(prefix)) {
        ans = ans.slice(prefix.length);
        break;
      }
    }
    // Strip leading subject pronouns when answer is "They/It verb" style
    // e.g. scaffold "...by h_____", answer "They hibernate" → "hibernate"
    const pronounMatch = ans.match(/^(they|it|he|she|we)\s+/i);
    if (pronounMatch) ans = ans.slice(pronounMatch[0].length);
  }

  return scaffold.replace(new RegExp(BLANK_CLUSTER.source, 'g'), ans);
}

export default function QuestionCard({ question, index, onFlag, onSwap, onRemove, scaffoldAll }) {
  const [revealed, setRevealed] = useState(false);
  const [localScaffold, setLocalScaffold] = useState(false);

  const showScaffold = scaffoldAll || localScaffold;
  const scaffold = question.scaffolded || `${question.question}: _____.`;

  return (
    <div
      className={`group relative h-full rounded-2xl px-6 py-4 cursor-pointer select-none transition-all flex flex-col justify-center ${
        question.flagged
          ? 'bg-amber-100 ring-2 ring-amber-400'
          : 'bg-orange-100 hover:bg-orange-50'
      }`}
      onClick={() => setRevealed(r => !r)}
    >
      {/* Hover controls */}
      <div
        className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
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

      {showScaffold ? (
        <>
          {/* Scaffold replaces the question entirely */}
          <p className={`text-gray-900 text-3xl font-semibold leading-snug pr-24 ${revealed ? 'text-gray-400' : ''}`}>
            <span className="font-bold mr-2">{index + 1})</span>
            {scaffold}
          </p>
          {/* Reveal shows the completed scaffold sentence */}
          {revealed && (
            <p className="mt-3 pt-3 border-t-2 border-orange-200 text-green-800 text-2xl font-medium">
              {completeScaffold(scaffold, question.question, question.answer)}
            </p>
          )}
        </>
      ) : (
        <>
          {/* Normal question */}
          <p className="text-gray-900 text-3xl font-semibold leading-snug pr-24">
            <span className="font-bold mr-2">{index + 1})</span>
            {question.question}
          </p>
          {/* Normal answer */}
          {revealed && (
            <p className="mt-3 pt-3 border-t-2 border-orange-200 text-green-800 text-2xl font-medium">
              {question.answer}
            </p>
          )}
        </>
      )}

      {question.flagged && (
        <span className="absolute bottom-3 left-5 text-amber-600 text-sm font-semibold">⚑ flagged</span>
      )}
    </div>
  );
}
