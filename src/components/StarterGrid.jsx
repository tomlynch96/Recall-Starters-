// Question tiles laid out two per row, sized to suit their questions: a row
// with a long question gets taller, and within a row the longer question gets
// the wider tile. Sizes depend only on the question text (not on answers being
// revealed) so the layout stays still while teaching.

function tileWeight(q) {
  if (!q) return 0.8; // empty slot
  return Math.min(1.6, Math.max(0.8, 0.6 + (q.question || '').length / 80));
}

export default function StarterGrid({ items, renderItem, emptyMessage, className = 'flex-[3]' }) {
  if (items.length === 0) {
    return <div className={`${className} min-h-0 flex items-center justify-center text-gray-400`}>{emptyMessage}</div>;
  }

  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2).map((q, j) => ({ q, index: i + j, weight: tileWeight(q) })));
  }

  return (
    <div className={`${className} min-h-0 flex flex-col gap-3`}>
      {rows.map((row, r) => (
        <div
          key={r}
          className="min-h-0 flex gap-3"
          style={{ flex: `${Math.max(...row.map(t => t.weight))} 1 0` }}
        >
          {row.map(t => (
            // Plain block stretched to the row's height, so the tile can't grow past it
            <div key={t.q ? t.q.id : `empty-${t.index}`} className="min-w-0 min-h-0" style={{ flex: `${t.weight} 1 0` }}>
              {renderItem(t.q, t.index)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
