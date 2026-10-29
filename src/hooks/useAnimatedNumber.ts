'use client';

import { useEffect, useRef, useState } from 'react';

// Número que "corre" até o valor novo (contador de questões encontradas)
export function useAnimatedNumber(target: number, duration = 450) {
  const [value, setValue] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = performance.now();
    const initial = from.current;
    if (initial === target) return;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(initial + (target - initial) * eased);
      setValue(next);
      from.current = next;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
