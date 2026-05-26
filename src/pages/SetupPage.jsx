import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, saveTeachers, getCurrentTeacher, getClassOptions } from '../utils/storage.js';
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

  const [selectedId, setSelectedId] = useState('');
  const [rotaId, setRotaId] = useState('rota-a');

  function handleSave(e) {
    e.preventDefault();
    const option = available.find(o => o.id === selectedId);
    if (!option) return;
    const all = getTeachers();
    all.push({
      id: generateUUID(),
      email,
      class_id: option.class_id,
      rota_id: rotaId,
      is_hod: false,
      created_at: new Date().toISOString(),
    });
    saveTeachers(all);
    navigate('/');
  }

  function registerAsHoD() {
    const all = getTeachers();
    if (!all.find(t => t.email === email && t.is_hod)) {
      all.push({
        id: generateUUID(),
        email,
        class_id: null,
        rota_id: null,
        is_hod: true,
        created_at: new Date().toISOString(),
      });
      saveTeachers(all);
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
            <p className="text-sm font-semibold text-gray-700 mb-1">Are you the HoD?</p>
            <p className="text-sm text-gray-500 mb-4">Set up your account first, then add the class list from the HoD dashboard.</p>
            <button onClick={registerAsHoD} className="w-full py-3 bg-blue-700 text-white font-semibold rounded-xl hover:bg-blue-800 transition-colors">
              Set up as HoD →
            </button>
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

  const selectedOption = available.find(o => o.id === selectedId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-blue-800 mb-2 text-center">Select your class</h1>
        <p className="text-gray-500 text-center mb-8">Logged in as <strong>{email}</strong></p>

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-md p-8 space-y-4">
          {/* Class picker */}
          <div className="space-y-3">
            {available.map(option => {
              const coTeachers = teachers.filter(t => t.class_id === option.class_id && t.email);
              return (
                <label
                  key={option.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    selectedId === option.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="class"
                    value={option.id}
                    checked={selectedId === option.id}
                    onChange={() => setSelectedId(option.id)}
                    className="accent-blue-600 mt-1"
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
              );
            })}
          </div>

          {/* Rota picker — shown once a class is selected */}
          {selectedOption && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Your teaching rota for {selectedOption.class_id}</label>
              <select
                value={rotaId}
                onChange={e => setRotaId(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
              >
                {ROTA_OPTIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedId}
            className="w-full bg-blue-700 text-white text-lg font-semibold py-3 rounded-xl hover:bg-blue-800 disabled:opacity-40 transition-colors"
          >
            Join class
          </button>
        </form>
      </div>
    </div>
  );
}
