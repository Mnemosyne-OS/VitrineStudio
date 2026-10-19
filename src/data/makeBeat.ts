/**
 * Makes ONE beat of a scene: the place, the piece set in it, or the living
 * thing added (doc 145 §10.3).
 *
 * Each beat is an EDIT of the one before (same camera, same framing), never a
 * new picture: that is what makes the dissolve between them seamless. So a
 * beat refuses to start when the one before it is missing, and the piece
 * refuses to start without the person's photo of THEIR piece (drawing it from
 * the words alone would stage a piece they never made).
 *
 * The host calls are injected: tested without credits.
 */
import { promptsFor, type TradeProfile, ENHANCE_PLACE_PROMPT } from '../model/profiles';
import type { Beat, Piece, Scene, StudioSettings } from '../model/types';
import { promptFor as basePrompt } from '../model/records';
import type { GenerateRequest } from './host';
import { scaleLine, type PieceShow } from '../model/showcase';

export interface BeatDeps {
  generate: (req: GenerateRequest) => Promise<{ path: string; model: string }>;
  /** Share of the room that changed, or null when it cannot be measured. */
  measure: (beforePath: string, afterPath: string) => Promise<number | null>;
  modelFor: (quality: StudioSettings['quality']) => string;
  now: () => Date;
}

export class BeatError extends Error {
  constructor(public readonly code: 'NO_PLACE_YET' | 'NO_PIECE_YET' | 'PIECE_HAS_NO_PHOTO' | 'NO_PLACE_DESCRIPTION', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'BeatError';
  }
}

export async function makeBeat(
  beat: Beat,
  scene: Scene,
  piece: Piece,
  profile: TradeProfile,
  settings: StudioSettings,
  deps: BeatDeps,
  /** The piece's real size, when she gave it: told to the model so the piece stays at scale. */
  size?: PieceShow['size'],
): Promise<Scene> {
  const prompts = promptsFor({
    profile,
    placeDescription: scene.placeDescription,
    ...(piece.description ? { pieceDescription: piece.description } : {}),
    animation: scene.animation,
  });
  const modelId = deps.modelFor(settings.quality);
  let req: GenerateRequest;
  // The person's own word for this picture goes after the instruction, whatever it is.
  const note = scene.beatNotes?.[beat]?.trim();
  // The real size goes on the beats that show the piece (the room alone has none), before her word.
  const scale = beat === 'place' ? null : scaleLine(size);
  const promptFor = (s: Scene, key: Beat, fallback: string) => basePrompt(s, key, fallback) + (scale ? ` ${scale}` : '') + (note ? ` ${note}` : '');
  if (beat === 'place' && scene.placeSourcePath) {
    // The person's own photo, enhanced: an edit of it, so the room and the camera stay theirs.
    req = { prompt: promptFor(scene, 'place', ENHANCE_PLACE_PROMPT), modelId, editImagePath: scene.placeSourcePath };
  } else if (beat === 'place') {
    if (!scene.placeDescription.trim()) throw new BeatError('NO_PLACE_DESCRIPTION');
    req = { prompt: promptFor(scene, 'place', prompts.place), aspectRatio: scene.aspectRatio, modelId };
  } else if (beat === 'piece') {
    if (!scene.images.place) throw new BeatError('NO_PLACE_YET');
    if (!piece.photoPath) throw new BeatError('PIECE_HAS_NO_PHOTO', piece.name);
    req = { prompt: promptFor(scene, 'piece', prompts.piece), modelId, editImagePath: scene.images.place, refImagePaths: [piece.photoPath] };
  } else {
    if (!scene.images.piece) throw new BeatError('NO_PIECE_YET');
    req = { prompt: promptFor(scene, 'alive', prompts.alive), modelId, editImagePath: scene.images.piece, ...(scene.animationRefPath ? { refImagePaths: [scene.animationRefPath] } : {}) };
  }

  const made = await deps.generate(req);
  const next: Scene = { ...scene, images: { ...scene.images, [beat]: made.path }, validated: false, updatedAt: deps.now().toISOString() };
  if (beat === 'piece' && scene.images.place) {
    // Measured, never assumed: a failed measure leaves the field ABSENT.
    try {
      const share = await deps.measure(scene.images.place, made.path);
      if (share === null) delete next.decorChange;
      else next.decorChange = share;
    } catch (err) {
      console.warn('[vitrine-studio] the room change could not be measured:', err);
      delete next.decorChange;
    }
  }
  return next;
}
