/**
 * The home film of a trade (doc 145 §10.7): a chain of keyframes, each an EDIT
 * of the one before (same camera), and one clip per consecutive pair, the end
 * of clip N being the start of clip N+1.
 *
 * 🚨 Data per trade, never a branch in the code. The ceramics chain is the one
 * made by hand for the first site (09/10); the three others were never
 * generated (⛔ doc 145 §10.7).
 *
 * The person is written without a gender everywhere: the first film's hands
 * came out male because nothing said otherwise, and the fix is the person's
 * own portrait as a reference, not a guess in the prompt.
 */
import { fillTemplate, type Lang, type TradeProfile } from './profiles';

type L10n = Record<Lang, string>;

/** What a step takes from the person, besides the keyframe before it. */
export type FilmRef = 'portrait' | 'piece' | 'animationRef';

export interface FilmStep {
  id: string;
  label: L10n;
  /** Holes: {workshop} {maker} {piece} {material} {animation}. */
  prompt: string;
  /**
   * First step only, when the person gave a photo of their workshop. The photo
   * is EDITED, never taken as is: the two pictures of one clip must come from
   * the same model at the same size.
   */
  photoPrompt?: string;
  refs: FilmRef[];
  /** The clip from the step before to this one. Absent on the first step. Holes as above, {maker} is the clip's own phrase. */
  clip?: string;
}

export interface TradeFilm {
  /** English default for {workshop}, when the person wrote nothing. */
  workshop: string;
  steps: FilmStep[];
}

const KEEP = 'Same camera, same framing, same workshop, same light. Nothing else in the image changes.';
const STILL_PHOTO = 'No people. Natural film photography, 35mm, fine grain, calm and minimal, editorial style. Eye-level, straight-on, locked camera.';
const FROM_PHOTO = 'Edit the image. Keep this workshop exactly as it is: same camera, same framing, same walls, same light.';

/** How the person appears in a keyframe, with or without their portrait. */
export const MAKER_IMAGE = {
  portrait: 'the craftsperson from the portrait reference (same face, same hair, same build), in a work apron',
  none: 'a craftsperson in a work apron, framed from the shoulders down so the face stays out of the frame',
} as const;
/** In a clip the model sees only the two frames: it is told who is there, never shown a reference. */
export const MAKER_CLIP = {
  portrait: 'The craftsperson',
  none: 'The craftsperson, face kept out of the frame,',
} as const;

/** What every film clip must not do. People are allowed here, unlike a scene's clip. */
/**
 * Her change to a keyframe's setting (Tony: « changer des éléments du décor »),
 * in her own words: only the setting moves, the person, the piece, the framing
 * and the light stay, so the pictures after it can be made from it again.
 */
export function decorPrompt(words: string): string {
  return `Change only these elements of the setting: ${words.trim()}. Keep the person, their hands, the piece, the framing, the camera angle and the light exactly as they are. A real photograph, no text, no watermark.`;
}

export const FILM_NEGATIVE = 'fast camera movement, shaky camera, cut, scene change, text, watermark, extra people, second person, face distortion, CGI, 3D render, flicker, morphing background';
const FILM_TAIL = ' Smooth, slow, steady camera only as described. The workshop, the walls and the light stay identical. Natural, calm, photographic, 35mm film look.';

const L = (en: string, fr: string, es: string): L10n => ({ en, fr, es });

export const FILMS: Record<string, TradeFilm> = {
  'ceramics-plants': {
    workshop: 'A quiet, sunlit pottery studio, a plain lime-washed wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre of the frame stands a potter's wheel with a ball of wet raw clay on its wheel head, a stool behind it, a small bowl of water beside it. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} A potter's wheel stands in the centre with a ball of wet raw clay on its wheel head; if the photo has none, add one that suits the room. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} is now seated behind the wheel facing the camera, wet hands raising the clay into a tall open cylinder, visible throwing rings, the wheel spinning (slight motion blur on the wheel head only), calm and focused, eyes on the clay. ${KEEP}`,
        clip: '{maker} walks in, sits down behind the potter\'s wheel, starts it and throws the ball of clay with wet hands: centres it, opens it and raises it into a tall wet cylinder, calm and focused. The camera very slowly dollies in.',
      },
      {
        id: 'raw', label: L('The raw piece', 'La pièce crue', 'La pieza cruda'), refs: [],
        prompt: `Edit the image. The person is gone and the wheel is still. On the wheel head stands the thrown cylinder, its clay now drier, matte and paler (leather-hard), clean walls with fine horizontal throwing lines. ${KEEP}`,
        clip: '{maker} gently releases the clay, the wheel slows down and stops, then stands up and walks out of the frame. Time passes: the wet clay dries, matte and paler, as the sunlight on the wall shifts softly. The camera very slowly dollies back out.',
      },
      {
        id: 'finished', label: L('Your creation', 'Votre création', 'Tu creación'), refs: ['piece'],
        prompt: `Edit the first image. Replace the raw clay piece on the wheel head with the finished {piece} from the reference image, EMPTY, exactly as it is: {material}, same shape and proportions. Take only the piece, never the plant or the background of the reference. ${KEEP}`,
        clip: 'Time passes: a soft warm glow rises over the raw clay piece as if it were fired in a kiln, then fades; the piece settles into the finished {piece}.',
      },
      {
        id: 'alive', label: L('The living', 'Le vivant', 'Lo vivo'), refs: ['animationRef'],
        prompt: `Edit the first image. Put {animation} in the {piece}, natural and healthy. The {piece} does not change. ${KEEP}`,
        clip: 'Timelapse: {animation} grows upward out of the soil inside the {piece}, leaves unfolding, until the final frame. Nothing enters from outside the {piece}.',
      },
    ],
  },
  lighting: {
    workshop: 'A quiet, sunlit maker workshop, a plain wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a sturdy workbench with the parts of a lamp laid out on it: a shade, a base, a coil of fabric cable, a few hand tools. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} On the workbench in the centre lie the parts of a lamp: a shade, a base, a coil of fabric cable, a few hand tools. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} now stands at the workbench facing the camera, assembling the lamp from its parts with careful hands, calm and focused. ${KEEP}`,
        clip: '{maker} walks in, stands at the workbench and assembles the lamp from its parts with careful hands. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('Switched off', 'Éteint', 'Apagada'), refs: ['piece'],
        prompt: `Edit the first image. The person, the parts and the tools are gone. On the workbench stands the {piece} from the reference image, SWITCHED OFF, exactly as it is: {material}, same shape and proportions. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: '{maker} sets the finished {piece} down on the cleared workbench and walks out of the frame. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('Switched on', 'Allumé', 'Encendida'), refs: [],
        prompt: 'Edit the first image. The {piece} is now switched on: {animation}. The {piece} does not change shape. Same camera, same framing, same workshop.',
        clip: 'The {piece} slowly switches on: {animation}. The light grows softly until the final frame; nothing else moves.',
      },
    ],
  },
  woodwork: {
    workshop: 'A quiet, sunlit woodworking shop, a plain wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a solid workbench with a rough plank of wood on it, a hand plane beside it. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} On the workbench in the centre lies a rough plank of wood with a hand plane beside it. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} now stands at the workbench, planing the plank, long curls of wood shavings falling, calm and focused. ${KEEP}`,
        clip: '{maker} walks in, takes the hand plane and planes the rough plank, long curls of shavings falling. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('Your creation', 'Votre création', 'Tu creación'), refs: ['piece'],
        prompt: `Edit the first image. The person, the plank and the shavings are gone. In the centre of the workshop stands the {piece} from the reference image, at a believable scale, exactly as it is: {material}, same shape and proportions. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: 'Time passes: {maker} puts the plane down and walks out of the frame, the shavings vanish and the finished {piece} stands in their place. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('In use', 'La vie', 'En uso'), refs: [],
        prompt: 'Edit the first image. Add {animation} on the {piece}, natural and understated. The {piece} does not change. Same camera, same framing, same workshop.',
        clip: 'Stop-motion, gentle: {animation} appear one by one on the {piece} until the final frame. The {piece} itself does not move.',
      },
    ],
  },
  jewellery: {
    workshop: "A quiet jeweller's bench by a window, soft daylight, close-up",
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. On the bench, a coil of silver wire, a small sheet of metal, fine pliers and a bench pin. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} On the bench lie a coil of silver wire, a small sheet of metal, fine pliers and a bench pin. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. Close-up: the hands of {maker} shape the wire with fine pliers against the bench pin, calm and precise. ${KEEP}`,
        clip: 'Close-up: two hands enter and shape the silver wire with fine pliers against the bench pin, calm and precise. The camera does not move.',
      },
      {
        id: 'finished', label: L('The jewel', 'Le bijou', 'La joya'), refs: ['piece'],
        prompt: `Edit the first image. The hands, the wire and the tools are gone. On the bench lies the {piece} from the reference image, exactly as it is: {material}, same shape and details. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: 'The hands set the finished {piece} down on the bench, clear the tools away and leave the frame. The camera does not move.',
      },
      {
        id: 'alive', label: L('The light', 'La lumière', 'La luz'), refs: [],
        prompt: 'Edit the first image. Add {animation}. The {piece} does not change. Same camera, same framing.',
        clip: 'Slowly, {animation}, until the final frame. The {piece} itself does not move.',
      },
    ],
  },
  sculpture: {
    workshop: 'A quiet, sunlit sculpture studio, a plain wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a modelling stand with a block of raw material on it, a few carving and modelling tools beside it. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} A modelling stand stands in the centre with a block of raw material on it; if the photo has none, add one that suits the room. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} now stands at the modelling stand, shaping the block with tools and hands, the first forms emerging, calm and focused. ${KEEP}`,
        clip: '{maker} walks in, takes the tools and shapes the raw block, the first forms emerging. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('The work', "L'œuvre", 'La obra'), refs: ['piece'],
        prompt: `Edit the first image. The person and the tools are gone. On the modelling stand stands the {piece} from the reference image, exactly as it is: {material}, same shape and proportions. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: 'Time passes: the rough form is refined into the finished {piece}; {maker} steps back and walks out of the frame. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('The light', 'La lumière', 'La luz'), refs: [],
        prompt: 'Edit the first image. Change only the light: {animation}. The {piece} does not change. Same camera, same framing, same workshop.',
        clip: 'Slowly, {animation}, moving across the {piece} until the final frame. The {piece} itself does not move.',
      },
    ],
  },
  painting: {
    workshop: "A quiet, sunlit painter's studio, a plain wall, soft window light from the left",
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a wooden easel holding a blank stretched canvas facing the camera, a palette and brushes on a stool beside it. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} An easel stands in the centre holding a blank canvas facing the camera, a palette and brushes beside it; if the photo has none, add one that suits the room. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} now stands beside the easel, painting on the canvas, the first colours and shapes appearing on it, calm and focused. The canvas still faces the camera. ${KEEP}`,
        clip: '{maker} walks in, picks up a brush and paints on the canvas, the first shapes and colours appearing. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('The work', "L'œuvre", 'La obra'), refs: ['piece'],
        prompt: `Edit the first image. The person is gone. On the easel stands the {piece} from the reference image, filling the canvas, exactly as it is: {material}. Take only the artwork, never the background of the reference. ${KEEP}`,
        clip: 'Time passes: the painting fills the canvas and becomes the finished {piece}; {maker} steps back and walks out of the frame. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('The light', 'La lumière', 'La luz'), refs: [],
        prompt: 'Edit the first image. Change only the light: {animation}. The {piece} does not change. Same camera, same framing, same workshop.',
        clip: 'Slowly, {animation}, until the final frame. The {piece} does not change or move.',
      },
    ],
  },
  textile: {
    workshop: 'A quiet, sunlit weaving studio, a plain wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a wooden loom with its warp threads stretched, cones of yarn on a shelf beside it. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} A wooden loom with its warp threads stands in the centre; if the photo has none, add one that suits the room. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} is now seated at the loom, weaving, the first rows of fabric appearing, calm and focused. ${KEEP}`,
        clip: '{maker} walks in, sits at the loom and weaves, row after row of fabric appearing. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('Your creation', 'Votre création', 'Tu creación'), refs: ['piece'],
        prompt: `Edit the first image. The person is gone. The {piece} from the reference image is laid over the front of the loom, exactly as it is: {material}. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: 'Time passes: the weaving grows into the finished {piece}; {maker} lays it over the front of the loom and walks out of the frame. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('In use', 'La vie', 'En uso'), refs: [],
        prompt: 'Edit the first image. Add {animation}. The {piece} does not change. Same camera, same framing, same workshop.',
        clip: 'Slowly, {animation}, until the final frame. The {piece} itself does not move.',
      },
    ],
  },
  products: {
    workshop: 'A quiet, sunlit small workshop, a plain wall, soft window light from the left',
    steps: [
      {
        id: 'workshop', label: L('The workshop', "L'atelier", 'El taller'), refs: [],
        prompt: `{workshop}. In the centre, a clean workbench with raw ingredients in bowls and a few empty containers. ${STILL_PHOTO}`,
        photoPrompt: `${FROM_PHOTO} On the workbench in the centre stand raw ingredients in bowls and a few empty containers. No people.`,
      },
      {
        id: 'making', label: L('The hands at work', 'Le geste', 'Las manos'), refs: ['portrait'],
        prompt: `Edit the first image. {maker} now stands at the workbench, preparing the product by hand, mixing and pouring, calm and focused. ${KEEP}`,
        clip: '{maker} walks in, mixes the ingredients by hand and pours them into the containers, calm and focused. The camera very slowly dollies in.',
      },
      {
        id: 'finished', label: L('The product', 'Le produit', 'El producto'), refs: ['piece'],
        prompt: `Edit the first image. The person, the bowls and the empty containers are gone. On the workbench stands the {piece} from the reference image, exactly as it is: {material}. Take only the {piece}, never the background of the reference. ${KEEP}`,
        clip: '{maker} sets the finished {piece} down on the cleared workbench and walks out of the frame. The camera very slowly dollies back out.',
      },
      {
        id: 'alive', label: L('The mood', "L'ambiance", 'El ambiente'), refs: [],
        prompt: 'Edit the first image. Add {animation}. The {piece}, its label and its text do not change. Same camera, same framing, same workshop.',
        clip: 'Slowly, {animation} appear around the {piece} until the final frame. The {piece} itself, its label and its text do not change.',
      },
    ],
  },
};

export function filmOf(profile: TradeProfile): TradeFilm {
  return FILMS[profile.id] ?? FILMS['ceramics-plants']!;
}

export interface FilmPromptInput {
  profile: TradeProfile;
  /** The person's words about their workshop; empty = the trade's default. */
  workshopDescription: string;
  fromPhoto: boolean;
  hasPortrait: boolean;
  pieceDescription?: string;
  animation: string;
}

/** The prompt of every keyframe, and of the clip that leads to it. */
export function filmPrompts(input: FilmPromptInput): Array<{ id: string; prompt: string; clip?: string }> {
  const { profile } = input;
  const film = filmOf(profile);
  const who = input.hasPortrait ? 'portrait' : 'none';
  const base = {
    workshop: input.workshopDescription.trim() || film.workshop,
    piece: profile.pieceNoun,
    material: input.pieceDescription?.trim() || profile.material,
    animation: profile.animations.find((a) => a.id === input.animation)?.prompt ?? input.animation,
  };
  return film.steps.map((step, i) => {
    const template = i === 0 && input.fromPhoto && step.photoPrompt ? step.photoPrompt : step.prompt;
    return {
      id: step.id,
      prompt: fillTemplate(template, { ...base, maker: MAKER_IMAGE[who] }),
      ...(step.clip ? { clip: fillTemplate(step.clip, { ...base, maker: MAKER_CLIP[who] }) + FILM_TAIL } : {}),
    };
  });
}
