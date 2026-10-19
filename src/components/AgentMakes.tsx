import { useEffect, useRef } from 'react';
import { hostIO } from '../data/host';
import { nextMake, readRequests, REQUESTS_EVERY_MS } from '../data/agentMakes';
import type { AgentMake, Scene } from '../model/types';
import type { MakeOutcome } from '../hooks/useScenes';

/**
 * Takes the pictures an agent asked for (data/agentMakes.ts) while the studio
 * is open: one scene at a time, through the same making as the « Faire »
 * button, so its progress and its errors show on the scene like any other.
 * Renders nothing.
 */
export function AgentMakes({ folder, scenesRef, saveScene, replaceScene, makeAll, busy, making }: {
  folder: string;
  scenesRef: { current: Scene[] };
  saveScene: (s: Scene) => Promise<void>;
  replaceScene: (s: Scene) => void;
  makeAll: (s: Scene) => Promise<MakeOutcome>;
  /** A scene being worked on (pictures, clip, layers) is left alone. */
  busy: (sceneId: string) => boolean;
  /** True while pictures are being made for ANY scene, by any door: nothing starts until it ends. */
  making: () => boolean;
}) {
  const latest = useRef({ saveScene, replaceScene, makeAll, busy, making });
  latest.current = { saveScene, replaceScene, makeAll, busy, making };

  useEffect(() => {
    let running = false;
    let gone = false;
    const write = async (scene: Scene, agentMake: AgentMake) => {
      const next: Scene = { ...scene, agentMake };
      await latest.current.saveScene(next);
      if (!gone) latest.current.replaceScene(next);
      return next;
    };
    // Every host call here carries its own deadline (data/host.ts, 15 s; a picture 210 s), and `running`
    // is released in `finally`. ⛔ No outer deadline on the tick: one that released `running` while
    // makeAll went on would start a second scene in parallel, the very thing this guard prevents.
    const tick = async () => {
      if (running || gone) return;
      running = true;
      try {
        const requests = await readRequests(hostIO, folder);
        if (!requests || gone) return;
        const next = nextMake(requests, scenesRef.current, latest.current.making(), latest.current.busy);
        if (!next) return;
        if (next.kind === 'drop') {
          await hostIO.deleteFile(next.request.path);
          return;
        }
        if (next.kind === 'settle') {
          await write(next.scene, { state: 'done', requestedAt: next.scene.agentMake!.requestedAt, at: new Date().toISOString() });
          return;
        }
        // Said in the scene BEFORE the first picture: a studio closed mid-way finishes it at its next start.
        const making = await write(next.scene, { state: 'making', requestedAt: next.requestedAt });
        if (next.request) {
          const removed = await hostIO.deleteFile(next.request.path);
          if (!removed.success) console.warn('[vitrine-studio] a taken make request could not be removed:', removed.error);
        }
        const outcome = await latest.current.makeAll(making);
        // The studio closed under it: the scene still says 'making', its next start resumes.
        if (gone || (!outcome.ok && outcome.error === 'CLOSED')) return;
        const now = scenesRef.current.find((s) => s.id === making.id) ?? outcome.scene;
        await write(now, outcome.ok
          ? { state: 'done', requestedAt: next.requestedAt, at: new Date().toISOString() }
          : { state: 'failed', requestedAt: next.requestedAt, at: new Date().toISOString(), error: outcome.error });
      } catch (err) {
        console.warn('[vitrine-studio] an agent request could not be handled:', err);
      } finally {
        running = false;
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), REQUESTS_EVERY_MS);
    return () => {
      gone = true;
      clearInterval(timer);
    };
  }, [folder, scenesRef]);

  return null;
}
