import { useEffect, useState } from 'react';

/**
 * A value copied to the clipboard, and what became of it, said for a moment.
 * The clipboard can refuse (a cartridge frame without the focus, a host that
 * does not allow it): the refusal is shown, never only logged.
 */
export function useCopy(): { copied: string | null; failed: string | null; copy: (value: string) => void } {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!copied && !failed) return;
    const id = window.setTimeout(() => { setCopied(null); setFailed(null); }, 1800);
    return () => window.clearTimeout(id);
  }, [copied, failed]);
  const copy = (value: string) => {
    setCopied(null);
    setFailed(null);
    Promise.resolve().then(() => navigator.clipboard.writeText(value)).then(() => setCopied(value), (err: unknown) => {
      console.warn('[vitrine-studio] copy refused:', err);
      setFailed(value);
    });
  };
  return { copied, failed, copy };
}
