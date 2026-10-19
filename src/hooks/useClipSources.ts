import { useEffect, useState } from 'react';
import { readMedia } from '../data/host';
import { describeError, errorText } from '../components/errors';

/**
 * The film's clips as playable addresses, each read once through the host (a
 * 6 s clip is a small file), shared by the part editor and the joins.
 */
export function useClipSources(paths: string[]) {
  const [srcs, setSrcs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const key = paths.join('|');
  useEffect(() => {
    let alive = true;
    for (const path of key ? key.split('|') : []) {
      readMedia(path).then(
        (url) => alive && setSrcs((all) => (all[path] ? all : { ...all, [path]: url })),
        (err: unknown) => alive && setError(errorText(describeError(err))),
      );
    }
    return () => { alive = false; };
  }, [key]);
  return { srcs, error };
}
