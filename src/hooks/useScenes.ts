import { useEffect, useRef, useState } from 'react';
import { hostIO } from '../data/host';
import { makeBeat } from '../data/makeBeat';
import { followClip, startClip } from '../data/makeClip';
import { beatDeps, clipDeps, clipFrameDeps } from '../data/hostDeps';
import { wideFrames } from '../data/clipFrames';
import type { SceneCaption } from '../model/caption';
import { dropTake, putClipBack, putTakeBack, takeFileFree } from '../model/takes';
import { MODEL_FOR_QUALITY } from '../data/host';
import { archiveScene, deleteSceneForGood, filesOwnedBy } from '../data/removeScene';
import { newScene, nextBeat, withoutFrom } from '../model/records';
import { profileById, scenePhrases } from '../model/profiles';
import type { Beat, ClipStyle, PromptKey, Scene, SceneMotion } from '../model/types';
import { layerDeps, makeSceneLayers } from '../data/sceneLayersMake';
import { layersCurrent, replacedLayerFiles } from '../model/sceneLayers';
import { readMedia } from '../data/host';
import type { PieceShow } from '../model/showcase';

/** What a redone picture is made from, chosen in the workbench. */
/** How a make ended, with the scene as it was last saved. */
export type MakeOutcome = { ok: true; scene: Scene } | { ok: false; error: string; scene: Scene };

export interface RemakeChange { note?: string; placeDescription?: string; animation?: string }
import { describeError } from '../components/errors';
import type { NewSceneInput, SceneWork } from '../components/ScenesPanel';
import type { RemoveMode, RemoveOutcome } from '../components/RemoveSceneDialog';
import type { Costs } from './useCosts';
import type { Studio } from './useStudio';

/**
 * The scenes: made beat by beat (saved after each, so a refusal keeps what
 * was made), their clip followed to its end, validated, rewritten, removed.
 * What each scene is doing shows in `work`, under the scene itself.
 */
export function useScenes(studio: Studio, costs: Costs, sizeOf: (pieceId: string) => PieceShow['size'] = () => undefined) {
  const { folder, alive, piecesRef, scenes, setScenes, scenesRef, replaceScene, saveScene, settings, loaded, filmsRef } = studio;
  const [work, setWork] = useState<Record<string, SceneWork>>({});
  const say = (id: string, w: SceneWork) => { if (alive.current) setWork((all) => ({ ...all, [id]: w })); };

  /**
   * Makes the missing beats one after the other, saving after each: a refusal
   * keeps what was made. Says how it ended (an agent's request records it).
   */
  const makeAll = async (start: Scene): Promise<MakeOutcome> => {
    if (!folder) return { ok: false, error: 'NO_FOLDER', scene: start };
    const piece = piecesRef.current.find((p) => p.id === start.pieceId);
    if (!piece) {
      say(start.id, { error: { key: 'error.unknownPiece' } });
      return { ok: false, error: 'error.unknownPiece', scene: start };
    }
    // The scene's own trade: changing the settings must not rewrite a scene half made.
    const profile = profileById(start.profileId ?? settings.profileId);
    let scene = start;
    for (let beat: Beat | null = nextBeat(scene); beat; beat = nextBeat(scene)) {
      const current = beat;
      say(scene.id, { making: current });
      try {
        scene = await makeBeat(current, scene, piece, profile, settings, { ...beatDeps, generate: costs.spendingImage(scene.id) }, sizeOf(piece.id));
        await saveScene(scene);
        if (!alive.current) return { ok: false, error: 'CLOSED', scene };
        replaceScene(scene);
      } catch (err) {
        console.warn(`[vitrine-studio] beat ${current} of ${scene.id} refused:`, err);
        const error = describeError(err);
        say(scene.id, { error });
        return { ok: false, error: error.key, scene };
      }
    }
    say(scene.id, {});
    return { ok: true, scene };
  };

  /**
   * The scene as it is NOW, with only the clip's outcome applied. A clip takes
   * minutes: the scene held at its start may since have been rewritten, or
   * removed (then nothing is written back, or it would come back from the
   * archive), or given a newer clip (then this outcome is not its own).
   */
  const settleClip = async (scene: Scene, outcome: Partial<Scene>) => {
    const current = scenesRef.current.find((x) => x.id === scene.id);
    if (!current || !scene.clipJob || current.clipJob?.id !== scene.clipJob.id) return null;
    const next: Scene = { ...current, ...outcome };
    delete next.clipJob;
    // A cut belongs to the clip it was set on.
    if (outcome.clipPath && outcome.clipPath !== current.clipPath) delete next.clipCut;
    // Shown first: a paid clip whose write fails stays on screen with its path, and the refusal is said.
    if (alive.current) replaceScene(next);
    await saveScene(next);
    return next;
  };

  /** Follows a started clip to its end; on any end the scene is saved, and a failure is said. */
  const followNow = async (scene: Scene) => {
    if (!folder) return;
    say(scene.id, { clipping: true });
    let done: Scene;
    try {
      done = await followClip(scene, costs.spendingClips(scene.id), () => {});
    } catch (err) {
      console.warn(`[vitrine-studio] clip of ${scene.id} ended without a clip:`, err);
      // The job is over either way: forget it, so the button comes back.
      try {
        await settleClip(scene, {});
      } catch (saveErr) {
        console.error('[vitrine-studio] the scene could not be saved after the clip:', saveErr);
      }
      say(scene.id, { error: describeError(err) });
      return;
    }
    try {
      await settleClip(scene, { clipPath: done.clipPath, validated: false, updatedAt: done.updatedAt });
      say(scene.id, {});
    } catch (err) {
      console.error('[vitrine-studio] the clip arrived but its scene was not written:', err);
      say(scene.id, { error: describeError(err) });
    }
  };

  /** Makes the clip; `style`, when given, is how it should move, saved with the scene first. */
  const makeClip = async (from: Scene, style?: ClipStyle) => {
    if (!folder) return;
    let scene = from;
    if (style) {
      const next: Scene = { ...from, updatedAt: new Date().toISOString() };
      if (Object.keys(style).length) next.clipStyle = style;
      else delete next.clipStyle;
      if (!(await update(from, next))) return;
      scene = next;
    }
    say(scene.id, { clipping: true });
    let started: Scene;
    try {
      // A scene not in the video's shape gets its wide frames first (once): mirrored sides animate as if they were the room.
      const framed = await wideFrames(scene, MODEL_FOR_QUALITY[settings.quality], { ...clipFrameDeps, generate: costs.spendingImage(scene.id) });
      if (framed !== scene) await saveScene(framed);
      started = await startClip(framed, profileById(scene.profileId ?? settings.profileId), clipDeps);
      await saveScene(started);
    } catch (err) {
      console.warn(`[vitrine-studio] clip of ${scene.id} refused:`, err);
      say(scene.id, { error: describeError(err) });
      return;
    }
    replaceScene(started);
    await followNow(started);
  };

  // A studio reloaded while a clip was being made picks its follow-up back, once.
  const resumed = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded) return;
    for (const s of scenesRef.current) {
      if (s.clipJob && !resumed.current.has(s.id)) {
        resumed.current.add(s.id);
        void followNow(s);
      }
    }
    // followNow reads the folder; scenes are read once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** Writes the new scene and, when asked, makes its pictures. Throws what the folder refused (the wizard says it). */
  /** Writes a new scene and resolves it (undefined without a folder); `makeNow` starts its pictures. */
  const createScene = async (input: NewSceneInput, makeNow: boolean, pageId: string | null = null): Promise<Scene | undefined> => {
    if (!folder) return undefined;
    const { placePhotoPath, enhancePlace, ...rest } = input;
    const scene = newScene(rest);
    scene.profileId = settings.profileId;
    if (pageId) scene.pageId = pageId;
    // The person's own photo of a room IS the first picture, as it is; or, asked
    // to be enhanced, the source of the first picture (made like the others).
    if (placePhotoPath && enhancePlace) {
      scene.placeSourcePath = placePhotoPath;
    } else if (placePhotoPath) {
      scene.images.place = placePhotoPath;
      scene.placeFromPhoto = true;
    }
    await saveScene(scene);
    scenesRef.current = [...scenesRef.current, scene];
    setScenes((all) => [...all, scene]);
    if (makeNow) void makeAll(scene);
    return scene;
  };

  /** Saves a change to one scene; a refusal shows under that scene. */
  const update = async (scene: Scene, next: Scene) => {
    try {
      await saveScene(next);
      replaceScene(next);
      return true;
    } catch (err) {
      say(scene.id, { error: describeError(err) });
      return false;
    }
  };

  /** Redoes a picture; `with`, when given, changes what it is made from first (her word, the place, what lives). */
  const remake = async (scene: Scene, beat: Beat, change?: RemakeChange) => {
    const base: Scene = { ...scene };
    if (change) {
      const notes = { ...(scene.beatNotes ?? {}) };
      if (change.note?.trim()) notes[beat] = change.note.trim();
      else delete notes[beat];
      if (Object.keys(notes).length) base.beatNotes = notes;
      else delete base.beatNotes;
      if (change.placeDescription?.trim()) base.placeDescription = change.placeDescription.trim();
      if (change.animation?.trim()) base.animation = change.animation.trim();
    }
    const cleared = withoutFrom(base, beat);
    if (await update(scene, cleared)) await makeAll(cleared);
  };

  /** Files the scene under another place (the grid's first axis). */
  const moveTo = (scene: Scene, universe: string) => (scene.universe === universe ? Promise.resolve(true) : update(scene, { ...scene, universe, updatedAt: new Date().toISOString() }));

  /** The part of the clip that plays; `null` = all of it. */
  const setClipCut = (scene: Scene, cut: { in: number; out: number } | null) => {
    const next: Scene = { ...scene, updatedAt: new Date().toISOString() };
    if (cut) next.clipCut = cut;
    else delete next.clipCut;
    return update(scene, next);
  };

  /** Puts a kept picture or clip back (the current one becomes a take). */
  const chooseTake = (scene: Scene, beat: Beat | 'clip', path: string) =>
    update(scene, { ...(beat === 'clip' ? putClipBack(scene, path) : putTakeBack(scene, beat, path)), validated: false, updatedAt: new Date().toISOString() });

  /** Deletes a take: out of the scene, then its file, unless something else still shows it. */
  const deleteTake = async (scene: Scene, beat: Beat | 'clip', path: string) => {
    const next = { ...dropTake(scene, beat, path), updatedAt: new Date().toISOString() };
    if (!(await update(scene, next))) return;
    const elsewhere = scenesRef.current.some((s) => s.id !== scene.id && !takeFileFree(s, path)) || !takeFileFree(next, path);
    if (elsewhere) return;
    const res = await hostIO.deleteFile(path).catch((err: unknown) => ({ success: false, error: String(err) }));
    if (!res.success) console.warn(`[vitrine-studio] the take ${path} left the scene but its file stayed:`, res.error);
  };

  /** The words over the scene; `null` takes them off. */
  const setCaption = (scene: Scene, caption: SceneCaption | null) => {
    const next: Scene = { ...scene, updatedAt: new Date().toISOString() };
    if (caption) next.caption = caption;
    else delete next.caption;
    return update(scene, next);
  };

  const validate = (scene: Scene, validated: boolean) => update(scene, { ...scene, validated, updatedAt: new Date().toISOString() });

  /** Advanced mode: the person's own instruction for one key, or back to the trade's (`undefined`). */
  const setScenePrompt = (scene: Scene, key: PromptKey, own: string | undefined) => {
    const prompts = { ...scene.prompts };
    if (own === undefined) delete prompts[key];
    else prompts[key] = own;
    const next: Scene = { ...scene, updatedAt: new Date().toISOString() };
    if (Object.keys(prompts).length) next.prompts = prompts;
    else delete next.prompts;
    return update(scene, next);
  };

  /** An enlargement recorded into its scene (the upscale card's batch, one after another). */
  const saveEnlarged = async (scene: Scene) => {
    await saveScene(scene);
    replaceScene(scene);
  };

  /** Archive (pictures kept) or delete for good (the pictures only this scene uses). The dialog says which files stayed. */
  const removeScene = async (scene: Scene, mode: RemoveMode): Promise<RemoveOutcome> => {
    if (!folder) return { ok: false, error: { key: 'error.unknown' } };
    try {
      let left: string[] = [];
      if (mode === 'archive') await archiveScene(hostIO, folder, scene, new Date().toISOString());
      else left = await deleteSceneForGood(hostIO, folder, scene, filesOwnedBy(scene, scenes, filmsRef.current));
      scenesRef.current = scenesRef.current.filter((x) => x.id !== scene.id);
      setScenes((all) => all.filter((x) => x.id !== scene.id));
      return { ok: true, left };
    } catch (err) {
      console.error('[vitrine-studio] the scene was not removed:', err);
      return { ok: false, error: describeError(err) };
    }
  };

  /**
   * How the scene moves on the site. « Living » makes its layers first when
   * they are missing or stale (free, on this machine: the host's matte on two
   * pictures, about 40 s each the first time); the steps show on the scene.
   * The scene is read again after: it may have changed while the matte ran.
   */
  const setMotion = async (scene: Scene, motion: SceneMotion) => {
    let layers = scene.layers;
    if (motion === 'living' && !layersCurrent(scene.layers, scene.images)) {
      const at = new Date().toISOString();
      say(scene.id, { layering: 'cut-piece', layeringAt: at });
      try {
        const phrases = scenePhrases(scene, settings.profileId);
        layers = await makeSceneLayers(scene, layerDeps(readMedia), (step) => say(scene.id, { layering: step, layeringAt: at }), phrases);
      } catch (err) {
        console.error('[vitrine-studio] the scene\'s layers were not made:', err);
        say(scene.id, { error: describeError(err) });
        return;
      }
    }
    // Removed while the matte ran: nothing is written back.
    const now = scenesRef.current.find((x) => x.id === scene.id);
    if (!now) return;
    const next: Scene = { ...now, motion, ...(layers ? { layers } : {}), updatedAt: new Date().toISOString() };
    if (!(await update(now, next))) return;
    say(scene.id, {});
    // The layers these replace are this scene's alone: their files go.
    for (const old of replacedLayerFiles(now.layers, next.layers)) {
      const res = await hostIO.deleteFile(old).catch((err: unknown) => ({ success: false, error: String(err) }));
      if (!res.success) console.warn(`[vitrine-studio] old layer ${old} stayed on disk:`, res.error);
    }
  };

  return { work, makeAll, makeClip, createScene, remake, validate, moveTo, setClipCut, chooseTake, deleteTake, setCaption, setScenePrompt, saveEnlarged, removeScene, setMotion };
}
