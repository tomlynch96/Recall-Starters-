import { useEffect, useState } from 'react';
import { whenHydrated } from './storage.js';

// True once the current login's data (including history logs) has loaded
export function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    whenHydrated().then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}
