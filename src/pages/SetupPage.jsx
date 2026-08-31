import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, getCurrentTeacher, getClassOptions, enrollTeacher } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';

const ROTA_OPTIONS = [
  { id: 'rota-a', label: 'Rota A — Solo teacher (6 lessons/fortnight)' },
  { id: 'rota-b-t1', label: 'Rota B — Teacher 1 (4 lessons/fortnight)' },
  { id: 'rota-b-t2', label: 'Rota B — Teacher 2 (2 lessons/fortnight)' },
  { id: 'rota-c-t1', label: 'Rota C — Teacher 1 (3 lessons/fortnight)' },
  { id: 'rota-c-t2', label: 'Rota C — Teacher 2 (3 lessons/fortnight)' },
];

export default function SetupPage() {
  const navigate = useNavigate();
  const email = getCurrentTeacher();
  const classOptions = getClassOptions();
  const teachers = getTeachers();

  const myClassIds = new Set(teachers.filter(t => t.email === email).map(t => t.class_id));
  const available = classOptions.filter(o => !myClassIds.has(o.class_id));
  const existingHoD = teachers.find(t => t.is_hod && t.email);
  const iAmHoD = teachers.some(t => t.email === email && t.is_hod);

  // selected: { [optionId]: true } · rotas: { [optionId]: rotaId } (starts empty)
  const [selected, setSelected] = useState({});
  const [rotas, setRotas] = useState({});

  const chosenIds = Object.keys(selected).filter(id => selected[id]);
  const allRotasChosen = chosenIds.every(id => rotas[id]);
  const canSubmit = chosenIds.length > 0 && allRotasChosen;

  function toggleClass(optionId) {
    setSelected(s => {
      const next = { ...s, [optionId]: !s[optionId] };
      if (!next[optionId]) {
        // Clearing a class also clears its rota choice
        setRotas(r => { const rr = { ...r }; delete rr[optionId]; return rr; });
      }
      return next;
    });
  }

  function handleSave(e) {
    e.preventDefault();
    if (!canSubmit) return;
    for (const id of chosenIds) {
      const option = available.find(o => o.id === id);
      if (!option) continue;
      enrollTeacher({
        id: generateUUID(),
        email,
        class_id: option.class_id,
        rota_id: rotas[id],
        is_hod: false,
        created_at: new Date().toISOString(),
      });
    }
    navigate('/');
  }

  function registerAsHoD() {
    const all = getTeachers();
    if (!all.find(t => t.email === email && t.is_hod)) {
      enrollTeacher({
        id: generateUUID(),
        email,
        class_id: null,
        rota_id: null,
        is_hod: true,
        created_at: new Date().toISOString(),
      });
    }
    navigate('/hod');
  }

  if (classOptions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No classes set up yet</h1>
          <p className="text-gray-500 mb-8">Your HoD needs to add the available classes before you can get started.</p>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-left">
            {existingHoD && !iAmHoD ? (
              <>
                <p className="text-sm font-semibold text-gray-700 mb-1">Your HoD</p>
                <p className="text-sm text-gray-500">
                  Contact <strong>{existingHoD.email}</strong> to add classes to the system.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-700 mb-1">Are you the HoD?</p>
                <p className="text-sm text-gray-500 mb-4">Set up your account first, then add the class list from the HoD dashboard.</p>
                <button onClick={registerAsHoD} className="w-full py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors">
                  Set up as HoD →
                </button>
              </>
            )}
          </div>
          <button onClick={() => navigate('/login')} className="mt-6 text-blue-600 hover:underline text-sm">← Back to login</button>
        </div>
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">You're all set</h1>
          <p className="text-gray-500 mb-6">You're already enrolled in all available classes.</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-700 text-white rounded-xl hover:bg-blue-800">Go to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-blue-800 mb-2 text-center">Add classes</h1>
        <p className="text-gray-500 text-center mb-8">Logged in as <strong>{email}</strong></p>

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-md p-8 space-y-4">
          <p className="text-sm text-gray-500">Tick every class you teach, then choose a rota for each.</p>
          <div className="space-y-3">
            {available.map(option => {
              const coTeachers = teachers.filter(t => t.class_id === option.class_id && t.email);
              const isTicked = !!selected[option.id];
              const needsRota = isTicked && !rotas[option.id];
              return (
                <div
                  key={option.id}
                  className={`rounded-xl border-2 transition-colors ${
                    isTicked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <label className="flex items-start gap-4 p-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTicked}
                      onChange={() => toggleClass(option.id)}
                      className="accent-blue-600 mt-1 w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-800">{option.class_id}</div>
                      {coTeachers.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {coTeachers.map(t => (
                            <span key={t.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              {t.email}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-0.5">No teachers yet</div>
                      )}
                    </div>
                  </label>

                  {isTicked && (
                    <div className="px-4 pb-4 -mt-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Your teaching rota</label>
                      <select
                        value={rotas[option.id] || ''}
                        onChange={e => setRotas(r => ({ ...r, [option.id]: e.target.value }))}
                        className={`w-full border-2 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-500 ${
                          needsRota ? 'border-amber-300 text-gray-400' : 'border-gray-200 text-gray-800'
                        }`}
                      >
                        <option value="" disabled>Select a rota…</option>
                        {ROTA_OPTIONS.map(r => (
                          <option key={r.id} value={r.id}>{r.label}</option>
                        ))}
                      </select>
                      {needsRota && <p className="text-xs text-amber-600 mt-1">Choose a rota to continue.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-blue-700 text-white text-lg font-semibold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {chosenIds.length > 1 ? `Join ${chosenIds.length} classes` : 'Join class'}
          </button>
        </form>

        <button onClick={() => navigate('/')} className="mt-4 w-full text-center text-gray-400 hover:text-gray-600 text-sm">
          ← Back to home
        </button>

        {/* HoD registration — only if no HoD exists yet or current user is HoD */}
        {(!existingHoD || iAmHoD) && (
          <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
            <p className="text-sm font-semibold text-gray-700 mb-1">Are you the HoD?</p>
            <p className="text-sm text-gray-500 mb-4">Set up your account first, then add the class list from the HoD dashboard.</p>
            <button onClick={registerAsHoD} className="w-full py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors">
              Set up as HoD →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
