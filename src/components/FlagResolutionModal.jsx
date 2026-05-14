export default function FlagResolutionModal({ question, onFineNow, onRevisit }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Flagged question check-in</h2>
        <p className="text-gray-500 text-sm mb-4">This question was previously flagged for review.</p>
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-gray-800 font-medium">{question.question}</p>
          <p className="text-gray-600 text-sm mt-2 italic">{question.answer}</p>
        </div>
        <p className="text-gray-700 font-semibold mb-4">Is this okay now?</p>
        <div className="flex gap-3">
          <button
            onClick={onFineNow}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Fine now ✓
          </button>
          <button
            onClick={onRevisit}
            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors"
          >
            Revisit again 🚩
          </button>
        </div>
      </div>
    </div>
  );
}
