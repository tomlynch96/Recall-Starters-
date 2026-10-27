import { useState, useEffect } from 'react';

// Click-to-edit text field. Blur or Ctrl/Cmd+Enter saves; Escape cancels.
// `renderView` overrides the non-editing display (e.g. a highlighted scaffold)
// while the editor still edits the raw `value`. `allowEmpty` permits clearing.
export default function EditableText({ value, onSave, className = '', placeholder = 'empty', inputClass = '', renderView = null, allowEmpty = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);

  if (editing) {
    return (
      <textarea
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const v = draft.trim();
          if (allowEmpty ? v !== value : (v && v !== value)) onSave(v);
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); setDraft(value); setEditing(false); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
        }}
        rows={2}
        className={`w-full border-2 border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500 resize-y ${inputClass}`}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`cursor-text rounded px-0.5 -mx-0.5 hover:bg-yellow-100 transition-colors ${className}`}
    >
      {renderView != null ? renderView : (value || <span className="text-gray-300 italic">{placeholder}</span>)}
    </span>
  );
}
