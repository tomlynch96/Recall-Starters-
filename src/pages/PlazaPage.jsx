import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getTeachers,
  getCurrentTeacher,
  getSessionLog,
  fetchPlazaMessages,
  leavePlazaMessage,
  deletePlazaMessage,
} from '../utils/storage.js';
import { generateUUID } from '../utils/uuid.js';
import BrainBuddy from '../components/BrainBuddy.jsx';

// Brain Plaza — easter egg. Every teacher's brain buddy wanders around;
// walk yours (WASD / arrows / tap) close to a colleague to leave them a note.

const TICK_MS = 40;
const SPEED_ME = 0.55;      // % of arena per tick
const SPEED_OTHERS = 0.09;
const CHAT_RADIUS = 13;     // % distance to trigger the note prompt

function firstName(email) {
  const raw = email.split('@')[0].split(/[._-]/)[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function PlazaPage() {
  const navigate = useNavigate();
  const email = getCurrentTeacher();

  const [chars, setChars] = useState(() => {
    const teachers = getTeachers();
    const sessionLog = getSessionLog();
    const emails = [...new Set(teachers.filter(t => t.email).map(t => t.email))];
    if (email && !emails.includes(email)) emails.push(email);
    return emails.map(e => ({
      email: e,
      isMe: e === email,
      sessions: sessionLog.filter(s => s.teacher_email === e).length,
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      vx: (Math.random() - 0.5) * SPEED_OTHERS * 2,
      vy: (Math.random() - 0.5) * SPEED_OTHERS * 2,
      facing: 1,
    }));
  });

  const keysRef = useRef(new Set());
  const targetRef = useRef(null); // tap-to-walk target
  const arenaRef = useRef(null);
  const [nearby, setNearby] = useState(null);        // email of closest colleague in range
  const [composing, setComposing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [toast, setToast] = useState('');
  const [inbox, setInbox] = useState([]);

  // Load messages waiting for me
  useEffect(() => {
    if (!email) return;
    fetchPlazaMessages(email).then(setInbox).catch(() => {});
  }, [email]);

  // Keyboard
  useEffect(() => {
    const down = e => {
      if (composing) return;
      keysRef.current.add(e.key.toLowerCase());
      if ((e.key === 'e' || e.key === 'Enter') && nearby) setComposing(true);
    };
    const up = e => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [composing, nearby]);

  // Game loop
  useEffect(() => {
    const t = setInterval(() => {
      setChars(cs => cs.map(c => {
        if (c.isMe) {
          if (composing) return c;
          const keys = keysRef.current;
          let dx = 0, dy = 0;
          if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
          if (keys.has('arrowright') || keys.has('d')) dx += 1;
          if (keys.has('arrowup') || keys.has('w')) dy -= 1;
          if (keys.has('arrowdown') || keys.has('s')) dy += 1;

          // Tap-to-walk when no keys held
          if (dx === 0 && dy === 0 && targetRef.current) {
            const { x: tx, y: ty } = targetRef.current;
            const ddx = tx - c.x, ddy = ty - c.y;
            const dist = Math.hypot(ddx, ddy);
            if (dist < 1.5) { targetRef.current = null; }
            else { dx = ddx / dist; dy = ddy / dist; }
          } else if (dx !== 0 || dy !== 0) {
            targetRef.current = null;
          }

          if (dx === 0 && dy === 0) return c;
          const norm = Math.hypot(dx, dy) || 1;
          return {
            ...c,
            x: clamp(c.x + (dx / norm) * SPEED_ME, 2, 94),
            y: clamp(c.y + (dy / norm) * SPEED_ME, 8, 88),
            facing: dx !== 0 ? Math.sign(dx) : c.facing,
          };
        }

        // Others wander: occasional direction change, bounce off edges
        let { vx, vy } = c;
        if (Math.random() < 0.015) {
          vx = (Math.random() - 0.5) * SPEED_OTHERS * 2;
          vy = (Math.random() - 0.5) * SPEED_OTHERS * 2;
        }
        let x = c.x + vx, y = c.y + vy;
        if (x < 2 || x > 94) { vx = -vx; x = clamp(x, 2, 94); }
        if (y < 8 || y > 88) { vy = -vy; y = clamp(y, 8, 88); }
        return { ...c, x, y, vx, vy, facing: vx !== 0 ? Math.sign(vx) : c.facing };
      }));
    }, TICK_MS);
    return () => clearInterval(t);
  }, [composing]);

  // Proximity check
  useEffect(() => {
    const me = chars.find(c => c.isMe);
    if (!me) return;
    let best = null;
    for (const c of chars) {
      if (c.isMe) continue;
      const d = Math.hypot(c.x - me.x, (c.y - me.y) * 1.3);
      if (d < CHAT_RADIUS && (!best || d < best.d)) best = { email: c.email, d };
    }
    setNearby(prev => (best?.email || null) === prev ? prev : (best?.email || null));
  }, [chars]);

  if (!email) {
    navigate('/');
    return null;
  }

  function handleArenaTap(e) {
    if (composing) return;
    const rect = arenaRef.current?.getBoundingClientRect();
    if (!rect) return;
    targetRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  function sendMessage() {
    const text = messageText.trim();
    if (!text || !nearby) return;
    leavePlazaMessage({
      id: generateUUID(),
      to_email: nearby,
      from_email: email,
      text,
      created_at: new Date().toISOString(),
    });
    setComposing(false);
    setMessageText('');
    setToast(`Note left for ${firstName(nearby)}! They'll find it next time they visit the plaza.`);
    setTimeout(() => setToast(''), 4000);
  }

  function dismissMessage(docId) {
    deletePlazaMessage(docId);
    setInbox(ib => ib.filter(m => m.docId !== docId));
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-sky-100 via-sky-50 to-green-100 select-none">
      {/* Header */}
      <header className="shrink-0 px-6 py-3 flex items-center gap-4 bg-white/60 backdrop-blur border-b border-white">
        <button onClick={() => navigate('/')} className="text-blue-600 hover:underline text-sm">← Back</button>
        <h1 className="text-lg font-bold text-blue-800">🧠 Brain Plaza</h1>
        <span className="text-xs text-gray-500 hidden sm:block">
          Walk with WASD / arrow keys (or tap). Get close to a colleague to leave them a note.
        </span>
      </header>

      {/* Arena */}
      <div ref={arenaRef} onPointerDown={handleArenaTap} className="relative flex-1 cursor-pointer">
        {/* A few decorative clouds/bushes */}
        <div className="absolute top-6 left-[15%] text-5xl opacity-40 pointer-events-none">☁️</div>
        <div className="absolute top-12 right-[20%] text-4xl opacity-40 pointer-events-none">☁️</div>
        <div className="absolute bottom-6 left-[8%] text-4xl opacity-50 pointer-events-none">🌳</div>
        <div className="absolute bottom-8 right-[10%] text-4xl opacity-50 pointer-events-none">🌳</div>
        <div className="absolute bottom-4 left-[45%] text-3xl opacity-50 pointer-events-none">🌼</div>

        {chars.map(c => (
          <div
            key={c.email}
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              transform: 'translate(-50%, -50%)',
              transition: `left ${TICK_MS}ms linear, top ${TICK_MS}ms linear`,
              zIndex: Math.round(c.y),
            }}
          >
            {/* Speech prompt above the colleague you're near */}
            {nearby === c.email && !composing && (
              <div className="absolute -top-9 whitespace-nowrap bg-white rounded-full shadow px-3 py-1 text-xs font-medium text-gray-700 animate-[fadeIn_0.3s_ease]">
                Press E to leave {firstName(c.email)} a note ✏️
              </div>
            )}
            <div style={{ transform: `scale(${c.isMe ? 0.62 : 0.55}) scaleX(${c.facing < 0 ? -1 : 1})`, transformOrigin: 'bottom center' }}>
              <BrainBuddy sessions={c.sessions} />
            </div>
            <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${c.isMe ? 'bg-blue-600 text-white' : 'bg-white/80 text-gray-600'}`}>
              {c.isMe ? 'You' : firstName(c.email)}
            </span>
          </div>
        ))}

        {/* Mobile note button */}
        {nearby && !composing && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setComposing(true); }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg hover:bg-blue-800"
          >
            ✏️ Leave {firstName(nearby)} a note
          </button>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-[fadeIn_0.3s_ease]">
            {toast}
          </div>
        )}
      </div>

      {/* Compose overlay */}
      {composing && nearby && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-6" onPointerDown={() => setComposing(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onPointerDown={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800 mb-3">Leave a note for {firstName(nearby)}</h2>
            <textarea
              autoFocus
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } if (e.key === 'Escape') setComposing(false); }}
              maxLength={280}
              rows={3}
              placeholder="Nice work on the Year 8 starters! 🎉"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setComposing(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={sendMessage} className="px-5 py-2 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800">Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Inbox: notes left for me */}
      {inbox.length > 0 && !composing && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="font-bold text-gray-800 mb-1">📬 You have notes waiting!</h2>
            <p className="text-xs text-gray-400 mb-4">Colleagues left these for you in the plaza.</p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {inbox.map(m => (
                <div key={m.docId} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-gray-800">{m.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">
                      — {firstName(m.from_email)}, {new Date(m.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => dismissMessage(m.docId)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      Got it ✓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
