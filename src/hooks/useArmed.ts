import { useEffect, useRef, useState } from 'react';

/** How long a first press keeps a paid action armed. */
export const ARMED_MS = 4000;
/** A second press sooner than this is the same double click, not a confirmation. */
export const DOUBLE_CLICK_MS = 400;

/**
 * A paid action asks a second press (Tony: « met une confirmation au bouton
 * régénérer »): the first press arms it, the second within a few seconds runs
 * it, otherwise it disarms itself. One armed action at a time, named by `key`.
 */
export function useArmed() {
  const [armed, setArmed] = useState<string | null>(null);
  const armedAt = useRef(0);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  const confirm = (key: string, run: () => void) => {
    if (armed !== key) { armedAt.current = Date.now(); setArmed(key); return; }
    if (Date.now() - armedAt.current < DOUBLE_CLICK_MS) return;
    setArmed(null);
    run();
  };
  return { armed, confirm };
}
