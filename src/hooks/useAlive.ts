import { useEffect, useRef } from 'react';

/**
 * False once the component is gone: an answer arriving after it sets no state.
 * Re-armed on every mount, because React may unmount and remount the effects
 * of a component still on screen (StrictMode, a hidden then shown subtree).
 */
export function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
