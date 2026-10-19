/**
 * The records of Vitrine Studio (doc 145 §10).
 *
 * A PIECE is the same file as a MnemoCRM product (`products/<id>.json`), so a
 * craftsperson who uses both keeps one catalogue. The studio only adds
 * `scenes/<id>.json` and `studio/settings.json` next to it.
 *
 * 🚨 Nothing here is about one trade. What a scene's three beats ARE (a plant
 * growing, a lamp switched on, objects of daily life) lives in a trade
 * profile, which is data (`profiles.ts`), never a branch in the code.
 */

/** Same value as MnemoCRM's PRODUCT_SCHEMA: the two cartridges read one file. */
export const PIECE_SCHEMA = 1 as const;
export const SCENE_SCHEMA = 1 as const;

export interface Piece {
  schema: typeof PIECE_SCHEMA;
  id: string;
  name: string;
  /** MnemoCRM's field: a unique piece or a series. */
  kind: 'unique' | 'series';
  price?: number;
  stock?: number;
  status?: 'available' | 'reserved' | 'sold';
  /** Absolute path of the person's photo of the piece. Never copied. */
  photoPath?: string;
  /** Material, size, what makes it this piece. Free text. */
  description?: string;
  tags: string[];
  /** An added catalogue page (model/pages.ts); absent = the Creations page. */
  pageId?: string;
  /** Her earlier photos of it, newest first: an improved photo never loses the one before (model/photoTakes.ts). */
  photoTakes?: string[];
  /** The piece lifted off the background of `from`, kept to lay it again on a colour without cutting twice. */
  cutout?: { from: string; path: string };
  createdAt?: string;
  updatedAt?: string;
}

/** The three beats every scene goes through. Their meaning comes from the trade profile. */
export type Beat = 'place' | 'piece' | 'alive';
export const BEATS: readonly Beat[] = ['place', 'piece', 'alive'];

/** How a scene moves on the site. */
export const SCENE_MOTIONS = ['images', 'living', 'video'] as const;
export type SceneMotion = (typeof SCENE_MOTIONS)[number];

export interface Scene {
  schema: typeof SCENE_SCHEMA;
  id: string;
  pieceId: string;
  /** An added scenes page (model/pages.ts); absent = the home's scenes. */
  pageId?: string;
  /** The grid's first axis, named by the person ("Salon", "Vitrine", "Terrasse"…). */
  universe: string;
  /** The second axis, inside a universe ("Console", "Fenêtre"…). */
  variant: string;
  /** The place, described by the person in their own words. */
  placeDescription: string;
  /** What animates the third beat, chosen from the profile or written freely. */
  animation: string;
  /** Optional photo the person gave for the third beat (their own plant, their own model). */
  animationRefPath?: string;
  aspectRatio: string;
  /** The generated pictures, absolute paths. A beat not made yet is ABSENT. */
  images: Partial<Record<Beat, string>>;
  /**
   * Share of pixels that changed between the place and the piece, measured
   * after the piece is set (0 to 1). Absent when not measured, never 0 by
   * default: a good edit changes a few percent, a scene whose room moved
   * changes much more.
   */
  decorChange?: number;
  /** The clip from the creation to the living (lot 4). */
  clipPath?: string;
  /** The part of the clip that plays, in seconds (to skip a flaw at its start or end). Absent = all of it. */
  clipCut?: { in: number; out: number };
  /** How the clip moves between its two pictures, chosen before it is made. Absent = still camera, steady light. */
  clipStyle?: ClipStyle;
  /** The person's own word for a picture, added to its instruction (« a bit more to the left »). */
  beatNotes?: Partial<Record<Beat, string>>;
  /** Words over the scene, read from the piece's record (model/caption.ts). */
  caption?: import('./caption').SceneCaption;
  /** Earlier versions of each picture, newest first, kept when it was redone (model/takes.ts). */
  takes?: Partial<Record<Beat, string[]>>;
  /** Earlier clips, newest first, with the cut and settings each had. */
  clipTakes?: Array<{ path: string; cut?: { in: number; out: number }; style?: ClipStyle }>;
  /**
   * The clip's frames in the video's own shape, made from the scene's pictures
   * when those are not (data/clipFrames.ts). `from` names the pictures they were
   * made from: a redone picture makes them stale.
   */
  clipFrames?: { piece: string; alive: string; from: { piece: string; alive: string } };
  /**
   * A clip being made: the host's job id and when it started, so a reloaded
   * studio picks the follow-up back. Absent once the clip is there or failed.
   */
  clipJob?: { id: string; startedAt: string };
  /**
   * Pictures enlarged on this machine (doc 88): `images[beat]` is then the
   * enlarged file, `from` the picture it was made from, `scale` the factor asked
   * (0 = an enlargement from before the factor existed: redone from `from`).
   * ABSENT for a beat never enlarged.
   */
  enlarged?: Partial<Record<Beat, { from: string; scale: number }>>;
  /**
   * The scene in layers (model/sceneLayers.ts): the place, the piece and the
   * life as cut-outs with their shadows, made on this machine for free. Stale
   * once a beat is redone (`from`); absent until made.
   */
  layers?: import('./sceneLayers').SceneLayers;
  /**
   * How the scene shows on the site: its three pictures, the living layers
   * (free, a few KB, the plant sways), or the clip (credits). Absent = the clip
   * when there is one, else the pictures, as before the choice existed.
   */
  motion?: SceneMotion;
  /**
   * The trade the scene was made under. Its beats and its "living" choice only
   * mean something in that profile: changing the trade in the settings must not
   * rewrite a scene half made (found by the doc 145 verification: a lighting
   * "night" read under ceramics became "Put night in the ceramic piece").
   */
  profileId?: string;
  /** The place is the person's own photo, not a generated picture: it cannot be "redone". */
  placeFromPhoto?: boolean;
  /**
   * The person's own photo the place is an ENHANCED copy of (better light,
   * tidier, same room and camera). The photo itself is never touched nor
   * deleted; the place can be redone from it.
   */
  placeSourcePath?: string;
  /**
   * Instructions the person rewrote by hand (advanced mode), per beat and for
   * the clip. ABSENT = the trade's own instruction, rebuilt each time from the
   * scene's words; present = sent exactly as written.
   */
  prompts?: Partial<Record<PromptKey, string>>;
  /** Only a validated scene goes on the website. */
  validated: boolean;
  /**
   * Pictures an agent asked for (data/agentMakes.ts): written ONLY by the
   * studio, from a request file the host drops in studio/requests/. Absent =
   * no agent ever asked.
   */
  agentMake?: AgentMake;
  createdAt: string;
  updatedAt: string;
}

export const AGENT_MAKE_STATES = ['making', 'done', 'failed'] as const;
/** Where an agent's request for a scene's pictures stands. */
export interface AgentMake {
  state: (typeof AGENT_MAKE_STATES)[number];
  /** When the agent asked (the request file's date). */
  requestedAt: string;
  /** When it ended; absent while making. */
  at?: string;
  /** Why it failed: the studio's error code, never a sentence. */
  error?: string;
}

/** What an instruction can be written for: a beat, or the clip. */
export type PromptKey = Beat | 'clip';

export const CLIP_CAMERAS = ['still', 'push', 'pan'] as const;
export const CLIP_LIGHTS = ['steady', 'sun'] as const;
export type ClipCamera = (typeof CLIP_CAMERAS)[number];
export type ClipLight = (typeof CLIP_LIGHTS)[number];
/** The clip's settings: the two pictures are fixed, so what can be chosen is how the camera and the light move, and a word of the person's own. */
export interface ClipStyle { camera?: ClipCamera; light?: ClipLight; note?: string }
export const PROMPT_MAX = 4000;

export interface StudioSettings {
  profileId: string;
  /** Shows, and lets the person rewrite, every instruction sent to the models. */
  advanced: boolean;
  /** 'quality' = the higher-cost model; 'fast' = the cheapest. */
  quality: 'quality' | 'fast';
  aspectRatio: string;
  /** The width pictures are enlarged to on this machine (doc 88). */
  upscaleScale: UpscaleScale;
  /** Shows what each scene cost on its card. */
  showCosts: boolean;
}

/** Of each picture's own width: x2 on a 1 392 px picture is 2 784 px. */
export type UpscaleScale = 1.5 | 2 | 3 | 4;
export const UPSCALE_SCALES: readonly UpscaleScale[] = [1.5, 2, 3, 4];

export const DEFAULT_SETTINGS: StudioSettings = { profileId: 'ceramics-plants', advanced: false, quality: 'quality', aspectRatio: '16:9', upscaleScale: 2, showCosts: false };
