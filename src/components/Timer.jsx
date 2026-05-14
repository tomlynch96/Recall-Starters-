import { useState, useEffect, useRef } from 'react';

const TOTAL = 5 * 60;

export default function Timer() {
  const [active, setActive] = useState(false);
  const [seconds, setSeconds] = useState(TOTAL);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [active, seconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const isRed = seconds <= 60;

  function toggle() {
    if (!active && seconds === 0) setSeconds(TOTAL);
    setActive(a => !a);
  }

  function reset() {
    setActive(false);
    setSeconds(TOTAL);
  }

  return (
    <div className="flex items-center gap-2">
      {(active || seconds < TOTAL) && (
        <span className={`font-mono text-4xl font-bold tabular-nums ${isRed ? 'text-red-500' : 'text-gray-700'}`}>
          {mm}:{ss}
        </span>
      )}
      <button
        onClick={toggle}
        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-base hover:bg-gray-200 transition-colors"
      >
        {active ? 'Pause' : seconds < TOTAL ? 'Resume' : 'Timer'}
      </button>
      {seconds < TOTAL && !active && (
        <button onClick={reset} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-base hover:bg-gray-200 transition-colors">
          Reset
        </button>
      )}
    </div>
  );
}
