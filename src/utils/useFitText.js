import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Shrinks text until the content fits its container (no overflow).
 * Returns [ref, scale]. Attach ref to a fixed-height, overflow-hidden
 * container and multiply your base font-size by scale.
 * Starts again from full size whenever deps change (new question, answer
 * toggled…) or the container is resized (going fullscreen, window resize),
 * so text is never left smaller than it needs to be.
 */
export function useFitText(deps, { min = 0.4, step = 0.05 } = {}) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);

  // Reset when the content changes
  useLayoutEffect(() => {
    setScale(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Reset when the box changes size
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = { w: el.clientWidth, h: el.clientHeight };
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      if (Math.abs(w - last.w) > 2 || Math.abs(h - last.h) > 2) {
        last = { w, h };
        setScale(1);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
