import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTeachers, saveTeachers, getCurrentTeacher } from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';

const ROTA_OPTIONS = [
  { id: 'rota-a', label: 'Rota A — Solo teacher (6 lessons/fortnight)' },
  { id: 'rota-b-t1', label: 'Rota B — Teacher 1 (4 lessons/fortnight)' },
  { id: 'rota-b-t2', label: 'Rota B — Teacher 2 (2 lessons/fortnight)' },
  { id: 'rota-c-t1', label: 'Rota C — Teacher 1 (3 lessons/fortnight)' },
  { id: 'rota-c-t2', label: 'Rota C — Teacher 2 (3 lessons/fortnight)' },
];

export default function SetupPage() {
  const [classId, setClassId] = useState('');
  const [rotaId, setRotaId] = useState('rota-a');
  const navigate = useNavigate();
  const email = getCurrentTeacher();

  function handleSave(e) {
    e.preventDefault();
    if (!classId.trim()) return;
    const teachers = getTeachers();
    teachers.push({
      id: generateUUID(),
      email,
      class_id: classId.trim(),
      rota_id: rotaId,
      is_hod: false,
      created_at: new Date().toISOString(),
    });
    saveTeachers(teachers);
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-blue-800 mb-2 text-center">Set up your class</h1>
        <p className="text-gray-500 text-center mb-8">Logged in as <strong>{email}</strong></p>
        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-md p-8 space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Class name</label>
            <input
              type="text"
              value={classId}
              onChange={e => setClassId(e.target.value)}
              placeholder="e.g. 10A/Sc1"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Teaching rota</label>
            <select
              value={rotaId}
              onChange={e => setRotaId(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
            >
              {ROTA_OPTIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-700 text-white text-lg font-semibold py-3 rounded-xl hover:bg-blue-800 transition-colors"
          >
            Save & Continue
          </button>
        </form>
      </div>
    </div>
  );
}
