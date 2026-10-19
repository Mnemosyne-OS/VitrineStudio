import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { hostIO } from '../data/host';
import { NO_WATCH, snapshotDirs, watchStep, WATCH_EVERY_MS, wroteRecently, type WatchState } from '../data/folderWatch';

/** How long the "folder read again" line stays. */
const LINE_MS = 6_000;

/**
 * Looks at the studio's record folders every few seconds while the studio is
 * on screen, and reads them again when someone else changed a file there (an
 * agent, another app, a person in the file explorer). One look at a time,
 * none while the window is hidden. Says it in one line that goes away.
 */
export function FolderWatch({ folder, onChange }: { folder: string; onChange: () => Promise<boolean> }) {
  const { tc } = useI18n();
  const [line, setLine] = useState<number | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    let state: WatchState = NO_WATCH;
    let running = false;
    let gone = false;
    let hideLine: ReturnType<typeof setTimeout> | undefined;
    const look = async () => {
      if (running || gone || document.hidden) return;
      running = true;
      try {
        const step = watchStep(state, await snapshotDirs(hostIO, folder), (p) => wroteRecently(p));
        state = step.state;
        if (step.changed && !gone && (await change.current()) && !gone) {
          setLine(step.changed);
          clearTimeout(hideLine);
          hideLine = setTimeout(() => setLine(null), LINE_MS);
        }
      } catch (err) {
        console.warn('[vitrine-studio] the folder could not be looked at:', err);
      } finally {
        running = false;
      }
    };
    void look();
    const timer = setInterval(() => void look(), WATCH_EVERY_MS);
    return () => {
      gone = true;
      clearInterval(timer);
      clearTimeout(hideLine);
    };
  }, [folder]);

  if (line === null) return null;
  return <p className="notice glass info folder-reread" role="status"><RefreshCw className="ico" aria-hidden />{tc('app.folderReread', line)}</p>;
}
