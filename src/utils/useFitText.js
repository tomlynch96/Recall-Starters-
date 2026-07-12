import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Shrinks text until the content fits its container (no overflow).
 * Returns [ref, scale]. Attach ref to a fixed-height, overflow-hidden
 * container and multiply your base font-size by scale.
 * Resets to full size whenever deps change (new question, answer toggled…).
 */
export function useFitText(deps, { min = 0.4, step = 0.05 } = {}) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  // Reset when the content changes
  useLayoutEffect(() => {
    setScale(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // After every render, shrink one step if still overflowing
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || scale <= min) return;
    if (el.scrollHeight > el.clientHeight + 1) {
      setScale(s => Math.max(min, Math.round((s - step) * 100) / 100));
    }
  });

  return [ref, scale];
}
