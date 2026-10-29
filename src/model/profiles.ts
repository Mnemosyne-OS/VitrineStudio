/**
 * Trade profiles: what the three beats of a scene MEAN for one trade, and the
 * prompts that make them (doc 145 §10.5).
 *
 * 🚨 A new trade is a new entry here, never an `if` in a component. The
 * prompts are templates with holes; `fillTemplate` is the only place they are
 * filled. They are in English because the image model follows English best;
 * everything the person reads is translated.
 *
 * The rules learnt on the first 38 pictures (doc 145 §4) are written INTO the
 * templates: one starting picture and edits of it, "same camera, same
 * framing", "only the object, never the reference's background", and an
 * EMPTY piece before the third beat.
 */
import type { Beat, ClipCamera, ClipLight, ClipStyle, Scene } from './types';

export type Lang = 'en' | 'fr' | 'es';
type L10n = Record<Lang, string>;

export interface Animation {
  id: string;
  label: L10n;
  /** English words the template drops into {animation}. */
  prompt: string;
}

/**
 * Company for the third beat: animals and children, NEAR the piece, never in
 * it (the trades' templates put a plant IN a pot). Their own instruction and
 * their own clip; offered only to the trades whose third beat is life
 * (pieces lit or hung change the light there instead), and never in the home
 * film, whose chain is the trade's. A child is shown from behind or by the
 * hands: never a face that could be taken for someone.
 */
export interface Companion extends Animation {
  /** A person in the frame: the clip's ban on people and hands is lifted for it. */
  person?: boolean;
}

export const COMPANIONS: Companion[] = [
  { id: 'cat', label: { en: 'A cat', fr: 'Un chat', es: 'Un gato' }, prompt: 'a calm cat curled up beside it' },
  { id: 'dog', label: { en: 'A dog', fr: 'Un chien', es: 'Un perro' }, prompt: 'a small dog resting beside it, looking at it' },
  { id: 'bird', label: { en: 'A bird', fr: 'Un oiseau', es: 'Un pájaro' }, prompt: 'a small songbird perched nearby' },
  { id: 'child-hands', label: { en: "A child's hands", fr: "Des mains d'enfant", es: 'Manos de niño' }, prompt: "a young child's small hands reaching gently toward it, the child's face out of the frame", person: true },
  { id: 'child', label: { en: 'A child playing', fr: 'Un enfant qui joue', es: 'Un niño jugando' }, prompt: 'a young child sitting on the floor nearby, seen from behind, playing quietly', person: true },
];

const COMPANY_TRADES = new Set(['ceramics-plants', 'woodwork', 'textile', 'products']);

/** The company a trade offers for its third beat (none where that beat is light). */
export function companionsFor(profile: TradeProfile): Companion[] {
  return COMPANY_TRADES.has(profile.id) ? COMPANIONS : [];
}

const companionOf = (profile: TradeProfile, id: string) => companionsFor(profile).find((c) => c.id === id);

/** Company is added beside the piece: never in it, never touching or covering it. */
const COMPANION_ALIVE = 'Edit the first image. Add {animation}, near the {piece}, natural and at ease, softly lit, with a shadow matching the room light. The {piece} itself does not change; nothing touches it or covers it. Same camera, same framing. Nothing else in the image changes: the room, the furniture and the light stay exactly as they are.';
const COMPANION_CLIP = 'Gently, {animation} comes into view and settles near the {piece} until the final frame. The {piece} itself does not move.';

/** A ready-made start for the place, offered as a tile: one tap fills the description. */
export interface PlaceIdea {
  id: string;
  label: L10n;
  /** English words for the room, dropped into {place}. */
  prompt: string;
}

/**
 * Places outside the home, offered to every trade whose pieces stand on
 * something (a painting gets walls instead, below). Each keeps the rule of
 * the indoor ones: one clear surface in the foreground, the rest softly blurred.
 */
export const OUTDOOR_IDEAS: PlaceIdea[] = [
  { id: 'city', label: { en: 'In town', fr: 'En ville', es: 'En la ciudad' }, prompt: 'A city café terrace, a small round table in the foreground, a stone facade and the street softly blurred behind, soft daylight' },
  { id: 'beach', label: { en: 'Beach', fr: 'Plage', es: 'Playa' }, prompt: 'A flat weathered stone by the sea, fine sand around it, the sea softly blurred behind, gentle morning light' },
  { id: 'nature', label: { en: 'Nature', fr: 'Nature', es: 'Naturaleza' }, prompt: 'A flat mossy rock in a quiet forest, ferns around it, dappled soft light, the trees blurred behind' },
  { id: 'market', label: { en: 'Market stall', fr: 'Marché', es: 'Mercado' }, prompt: 'An artisan market stall, a plain wooden table with a linen cloth in the foreground, the stalls and passers-by softly blurred behind, daylight' },
  { id: 'mountain', label: { en: 'Mountain', fr: 'Montagne', es: 'Montaña' }, prompt: 'A flat rock high in the mountains, alpine grass around it, peaks softly blurred in the distance, clear morning light' },
  { id: 'cafe', label: { en: 'Café', fr: 'Café', es: 'Café' }, prompt: 'A quiet café, a small marble table in the foreground, the counter and chairs softly blurred behind, warm daylight' },
  { id: 'hotel', label: { en: 'Hotel', fr: 'Hôtel', es: 'Hotel' }, prompt: 'A calm hotel lobby, a low wooden console in the foreground, the lobby softly blurred behind, soft warm light' },
  { id: 'workshop', label: { en: 'Workshop', fr: 'Atelier', es: 'Taller' }, prompt: "An artisan's workshop, a clear worn wooden workbench in the foreground, tools and shelves softly blurred behind, daylight from a window" },
  { id: 'office', label: { en: 'Office', fr: 'Bureau', es: 'Oficina' }, prompt: 'A calm office, a clear wooden desk in the foreground, shelves and a window softly blurred behind, soft daylight' },
  { id: 'boutique', label: { en: 'Boutique', fr: 'Boutique', es: 'Tienda' }, prompt: 'A small concept store, a clear display table in the foreground, shelves of goods softly blurred behind, soft warm light' },
  { id: 'restaurant', label: { en: 'Restaurant', fr: 'Restaurant', es: 'Restaurante' }, prompt: 'A warm restaurant, a clear wooden table in the foreground, the dining room softly blurred behind, soft evening light' },
  { id: 'terrace', label: { en: 'Terrace', fr: 'Terrasse', es: 'Terraza' }, prompt: 'A sunny rooftop terrace, a low stone table in the foreground, potted plants and the sky softly blurred behind, warm afternoon light' },
  { id: 'gallery', label: { en: 'Gallery', fr: 'Galerie', es: 'Galería' }, prompt: 'A white gallery room, a white plinth in the foreground, the white walls softly blurred behind, even soft light' },
  { id: 'hotel-bathroom', label: { en: 'Hotel bathroom', fr: "Salle de bain d'hôtel", es: 'Baño de hotel' }, prompt: 'A refined hotel bathroom, a clear stone vanity counter beside the basin in the foreground, marble and brass softly blurred behind, soft warm light' },
];

/** A painting hangs: the same places elsewhere, as a wall to hang it on. */
const WALLS_ELSEWHERE: PlaceIdea[] = [
  { id: 'cafe', label: { en: 'Café', fr: 'Café', es: 'Café' }, prompt: 'A quiet café, a plain empty wall above a row of small tables, warm daylight' },
  { id: 'hotel', label: { en: 'Hotel', fr: 'Hôtel', es: 'Hotel' }, prompt: 'A calm hotel lobby, a large plain empty wall above a low console, soft warm light' },
  { id: 'workshop', label: { en: 'Workshop', fr: 'Atelier', es: 'Taller' }, prompt: "An artist's workshop, a plain empty white wall above a worn workbench, daylight from a window" },
  { id: 'office', label: { en: 'Office', fr: 'Bureau', es: 'Oficina' }, prompt: 'A calm office, a plain empty wall above a wooden desk, soft daylight' },
  { id: 'boutique', label: { en: 'Boutique', fr: 'Boutique', es: 'Tienda' }, prompt: 'A small concept store, a plain empty wall above a display table, soft warm light' },
  { id: 'restaurant', label: { en: 'Restaurant', fr: 'Restaurant', es: 'Restaurante' }, prompt: 'A warm restaurant, a plain empty wall above a row of tables, soft evening light' },
  { id: 'hotel-bathroom', label: { en: 'Hotel bathroom', fr: "Salle de bain d'hôtel", es: 'Baño de hotel' }, prompt: 'A refined hotel bathroom, a plain empty wall above the bathtub, marble and brass, soft warm light' },
];

/** The places outside the home a trade offers, without those already among its own (sculpture has its gallery). */
export function outdoorIdeas(profile: TradeProfile): PlaceIdea[] {
  const own = new Set(profile.placeIdeas.map((i) => i.id));
  return (profile.id === 'painting' ? WALLS_ELSEWHERE : OUTDOOR_IDEAS).filter((i) => !own.has(i.id));
}

/**
 * The person's own photo of the place, made more appealing without becoming
 * another place: the same room, the same furniture, the same camera.
 */
export const ENHANCE_PLACE_PROMPT = 'Improve this photograph of a place without changing it: the same room, the same furniture and objects in the same places, the same camera, framing and perspective. Better soft natural light, cleaner and tidier surfaces, stray clutter removed, sharper and more appealing, like a professional interior photograph. Add no object, change no wall, window or furniture.';

export interface TradeProfile {
  id: string;
  label: L10n;
  /** What each beat is called on screen. */
  beats: Record<Beat, L10n>;
  /** English noun for the piece in the prompts ("stoneware vessel", "lamp"). */
  pieceNoun: string;
  /**
   * What the living beat usually adds, named for the host's phrase matte (doc 189 §5):
   * « the plant » for pots. Named on every living cut, because the generator does not
   * always draw what was asked (a « cat » scene came back with a plant, 2026-10-28).
   * Absent where the living beat adds no object (a lamp switched on).
   */
  aliveNoun?: string;
  /** English default for the material, used when the piece has no description. */
  material: string;
  animations: Animation[];
  /** Places this trade is usually shown in. The person can always write their own. */
  placeIdeas: PlaceIdea[];
  /** Templates. Holes: {place} {piece} {material} {animation}. */
  templates: Record<Beat, string>;
  /**
   * The clip from the creation to the living (lot 4), same holes. It must say
   * where the change starts: a first clip let a vine crawl in from outside the
   * frame instead of growing from the pot (09/10).
   */
  clip: string;
}

const PLACE_TAIL = 'The surface sits in the lower third of the frame, with generous empty space above it. No objects, no people. Natural film photography, 35mm, fine grain, quiet and minimal, editorial style. Eye-level, straight-on, locked camera.';
const KEEP = 'Same camera, same framing. Nothing else in the image changes: the room, the furniture and the light stay exactly as they are.';
const ONLY_OBJECT = 'Take only the object from the reference image, never its background, its table or its surroundings.';

export const PROFILES: TradeProfile[] = [
  {
    id: 'ceramics-plants',
    label: { en: 'Ceramics and plants', fr: 'Céramique et plantes', es: 'Cerámica y plantas' },
    beats: {
      place: { en: 'The place', fr: 'Le lieu', es: 'El lugar' },
      piece: { en: 'Your creation', fr: 'Votre création', es: 'Tu creación' },
      alive: { en: 'The living', fr: 'Le vivant', es: 'Lo vivo' },
    },
    pieceNoun: 'ceramic piece',
    aliveNoun: 'the plant',
    material: 'unglazed matte stoneware, visible grain',
    animations: [
      { id: 'pothos', label: { en: 'Pothos', fr: 'Pothos', es: 'Potos' }, prompt: 'a lush green pothos, a few stems trailing over the rim' },
      { id: 'eucalyptus', label: { en: 'Eucalyptus', fr: 'Eucalyptus', es: 'Eucalipto' }, prompt: 'a bunch of silver-green eucalyptus stems' },
      { id: 'olive', label: { en: 'Olive branch', fr: "Branche d'olivier", es: 'Rama de olivo' }, prompt: 'a few slender olive branches' },
      { id: 'dried', label: { en: 'Dried flowers', fr: 'Fleurs séchées', es: 'Flores secas' }, prompt: 'a few delicate dried flowers and grass stems, sparse' },
      { id: 'succulents', label: { en: 'Succulents', fr: 'Succulentes', es: 'Suculentas' }, prompt: 'small succulents slightly overflowing the rim' },
      { id: 'monstera', label: { en: 'Monstera', fr: 'Monstera', es: 'Monstera' }, prompt: 'a young monstera with a few broad split leaves' },
      { id: 'fern', label: { en: 'Fern', fr: 'Fougère', es: 'Helecho' }, prompt: 'a soft green fern, fronds arching over the rim' },
      { id: 'lavender', label: { en: 'Lavender', fr: 'Lavande', es: 'Lavanda' }, prompt: 'a small bush of flowering lavender, purple spikes' },
      { id: 'herbs', label: { en: 'Herbs', fr: 'Aromatiques', es: 'Aromáticas' }, prompt: 'fresh herbs, basil and thyme, small and dense' },
      { id: 'cactus', label: { en: 'Cactus', fr: 'Cactus', es: 'Cactus' }, prompt: 'a small round cactus with fine spines' },
      { id: 'ivy', label: { en: 'Ivy', fr: 'Lierre', es: 'Hiedra' }, prompt: 'a little ivy with stems spilling down the side' },
      { id: 'orchid', label: { en: 'Orchid', fr: 'Orchidée', es: 'Orquídea' }, prompt: 'a white orchid on a slender stem, a few flowers open' },
      { id: 'wildflowers', label: { en: 'Wildflowers', fr: 'Fleurs des champs', es: 'Flores silvestres' }, prompt: 'a loose bunch of wildflowers, poppies and cornflowers' },
    ],
    placeIdeas: [
      { id: 'living', label: { en: 'Living room', fr: 'Salon', es: 'Salón' }, prompt: 'A calm living room, a console table against a plain wall, soft morning light from the left' },
      { id: 'bedroom', label: { en: 'Bedroom', fr: 'Chambre', es: 'Dormitorio' }, prompt: 'A quiet bedroom, a bedside table next to a made bed, a plain wall, soft morning light' },
      { id: 'kitchen', label: { en: 'Kitchen', fr: 'Cuisine', es: 'Cocina' }, prompt: 'A kitchen, a clear worktop against the wall, daylight from a window' },
      { id: 'bathroom', label: { en: 'Bathroom', fr: 'Salle de bain', es: 'Baño' }, prompt: 'A bathroom, a counter next to the basin, soft daylight' },
      { id: 'garden', label: { en: 'Garden', fr: 'Jardin', es: 'Jardín' }, prompt: 'An outdoor terrace against a garden wall, a low ledge, soft morning light, blurred greenery' },
      { id: 'window', label: { en: 'Window sill', fr: 'Rebord de fenêtre', es: 'Alféizar' }, prompt: 'A deep window sill, a window on trees outside, soft diffuse light' },
    ],
    clip: 'Timelapse: {animation} slowly grows upward out of the soil inside the {piece}, leaves unfolding, until the final frame. Nothing enters from outside the {piece}.',
    templates: {
      place: `{place}. ${PLACE_TAIL} No vases, no plants.`,
      piece: `Edit the first image. Place only the {piece} from the reference image on the surface, near the centre, standing naturally on it. It must be EMPTY: no plant, no flowers, even if the reference shows some. Keep it exactly as it is: {material}, same shape, proportions and colour. ${ONLY_OBJECT} Match the room light and cast a soft natural shadow. ${KEEP}`,
      alive: `Edit the first image. Put {animation} in the {piece}, natural, healthy and softly lit, with a shadow matching the room light. The {piece} itself does not change. ${KEEP} Only the plant is added.`,
    },
  },
  {
    id: 'lighting',
    label: { en: 'Lighting', fr: 'Luminaires', es: 'Iluminación' },
    beats: {
      place: { en: 'The place', fr: 'Le lieu', es: 'El lugar' },
      piece: { en: 'Switched off', fr: 'Éteint', es: 'Apagada' },
      alive: { en: 'Switched on', fr: 'Allumé', es: 'Encendida' },
    },
    pieceNoun: 'lamp',
    material: 'as in the reference',
    animations: [
      { id: 'warm', label: { en: 'Warm light at dusk', fr: 'Lumière chaude au crépuscule', es: 'Luz cálida al atardecer' }, prompt: 'warm 2700K light at dusk, the room slightly darker' },
      { id: 'night', label: { en: 'Night', fr: 'Nuit', es: 'Noche' }, prompt: 'its warm light at night, the room dark around it' },
    ],
    placeIdeas: [
      { id: 'living', label: { en: 'Living room', fr: 'Salon', es: 'Salón' }, prompt: 'A calm living room, a console table against a plain wall, soft morning light from the left' },
      { id: 'bedroom', label: { en: 'Bedroom', fr: 'Chambre', es: 'Dormitorio' }, prompt: 'A quiet bedroom, a bedside table next to a made bed, a plain wall, soft morning light' },
      { id: 'kitchen', label: { en: 'Kitchen', fr: 'Cuisine', es: 'Cocina' }, prompt: 'A kitchen, a clear worktop against the wall, daylight from a window' },
      { id: 'bathroom', label: { en: 'Bathroom', fr: 'Salle de bain', es: 'Baño' }, prompt: 'A bathroom, a counter next to the basin, soft daylight' },
      { id: 'garden', label: { en: 'Garden', fr: 'Jardin', es: 'Jardín' }, prompt: 'An outdoor terrace against a garden wall, a low ledge, soft morning light, blurred greenery' },
      { id: 'window', label: { en: 'Window sill', fr: 'Rebord de fenêtre', es: 'Alféizar' }, prompt: 'A deep window sill, a window on trees outside, soft diffuse light' },
    ],
    clip: 'The {piece} slowly switches on: {animation}. The light grows softly until the final frame; nothing else moves.',
    templates: {
      place: `{place}. ${PLACE_TAIL} No lamps.`,
      piece: `Edit the first image. Place only the {piece} from the reference image on the surface, SWITCHED OFF, exactly as it is: {material}, same shape and proportions. ${ONLY_OBJECT} ${KEEP}`,
      alive: `Edit the first image. The {piece} is now switched on: {animation}. The {piece} itself does not change shape. Same camera, same framing, the furniture stays where it is.`,
    },
  },
  {
    id: 'woodwork',
    label: { en: 'Woodwork and furniture', fr: 'Bois et mobilier', es: 'Madera y mobiliario' },
    beats: {
      place: { en: 'The place', fr: 'Le lieu', es: 'El lugar' },
      piece: { en: 'Your creation', fr: 'Votre création', es: 'Tu creación' },
      alive: { en: 'In use', fr: 'La vie', es: 'En uso' },
    },
    pieceNoun: 'wooden piece',
    material: 'as in the reference, real wood grain',
    animations: [
      { id: 'books', label: { en: 'Books and a cup', fr: 'Des livres et une tasse', es: 'Libros y una taza' }, prompt: 'a few books and a ceramic cup, as if someone just left' },
      { id: 'fruit', label: { en: 'A bowl of fruit', fr: 'Une coupe de fruits', es: 'Un frutero' }, prompt: 'a simple bowl of seasonal fruit' },
    ],
    placeIdeas: [
      { id: 'living', label: { en: 'Living room', fr: 'Salon', es: 'Salón' }, prompt: 'A calm living room, a console table against a plain wall, soft morning light from the left' },
      { id: 'bedroom', label: { en: 'Bedroom', fr: 'Chambre', es: 'Dormitorio' }, prompt: 'A quiet bedroom, a bedside table next to a made bed, a plain wall, soft morning light' },
      { id: 'kitchen', label: { en: 'Kitchen', fr: 'Cuisine', es: 'Cocina' }, prompt: 'A kitchen, a clear worktop against the wall, daylight from a window' },
      { id: 'bathroom', label: { en: 'Bathroom', fr: 'Salle de bain', es: 'Baño' }, prompt: 'A bathroom, a counter next to the basin, soft daylight' },
      { id: 'garden', label: { en: 'Garden', fr: 'Jardin', es: 'Jardín' }, prompt: 'An outdoor terrace against a garden wall, a low ledge, soft morning light, blurred greenery' },
      { id: 'window', label: { en: 'Window sill', fr: 'Rebord de fenêtre', es: 'Alféizar' }, prompt: 'A deep window sill, a window on trees outside, soft diffuse light' },
    ],
    clip: 'Stop-motion, gentle: {animation} appear one by one on the {piece} until the final frame. The {piece} itself does not move.',
    templates: {
      place: `{place}. The floor and the empty wall fill the frame, with generous empty space in the centre. No furniture there, no people. Natural film photography, 35mm, fine grain, quiet and minimal, editorial style. Eye-level, straight-on, locked camera.`,
      piece: `Edit the first image. Place only the {piece} from the reference image in the empty space, at a believable scale for the room, exactly as it is: {material}, same shape and proportions. ${ONLY_OBJECT} Match the room light and cast a soft natural shadow. ${KEEP}`,
      alive: `Edit the first image. Add {animation} on the {piece}, natural and understated. The {piece} itself does not change. ${KEEP}`,
    },
  },
  {
    id: 'jewellery',
    label: { en: 'Jewellery', fr: 'Bijoux', es: 'Joyería' },
    beats: {
      place: { en: 'The setting', fr: 'Le décor', es: 'El escenario' },
      piece: { en: 'The jewel', fr: 'Le bijou', es: 'La joya' },
      alive: { en: 'The light', fr: 'La lumière', es: 'La luz' },
    },
    pieceNoun: 'jewel',
    material: 'as in the reference, true metal colour and stones',
    animations: [
      { id: 'sun', label: { en: 'A ray of sun', fr: 'Un rayon de soleil', es: 'Un rayo de sol' }, prompt: 'a soft ray of sunlight catching the metal, with a gentle sparkle' },
      { id: 'flower', label: { en: 'A fresh flower', fr: 'Une fleur fraîche', es: 'Una flor fresca' }, prompt: 'a single small fresh flower lying beside it' },
    ],
    placeIdeas: [
      { id: 'marble', label: { en: 'Marble', fr: 'Marbre', es: 'Mármol' }, prompt: 'A white marble surface with soft grey veins' },
      { id: 'linen', label: { en: 'Linen', fr: 'Lin', es: 'Lino' }, prompt: 'A soft natural linen cloth with gentle folds' },
      { id: 'wood', label: { en: 'Wood', fr: 'Bois', es: 'Madera' }, prompt: 'A pale oak surface with a fine grain' },
      { id: 'stone', label: { en: 'Stone', fr: 'Pierre', es: 'Piedra' }, prompt: 'A smooth river stone surface, warm grey' },
    ],
    clip: 'Slowly, {animation}, until the final frame. The {piece} itself does not move.',
    templates: {
      place: `{place}. Close-up, the surface fills the lower half of the frame, generous empty space in the centre. No jewellery, no people. Natural macro photography, soft light, fine grain, quiet and minimal. Locked camera.`,
      piece: `Edit the first image. Place only the {piece} from the reference image in the centre of the surface, exactly as it is: {material}, same shape, proportions and details. ${ONLY_OBJECT} Match the light, soft natural shadow. ${KEEP}`,
      alive: `Edit the first image. Add {animation}. The {piece} itself does not change. Same camera, same framing.`,
    },
  },
  {
    id: 'sculpture',
    label: { en: 'Sculpture', fr: 'Sculpture', es: 'Escultura' },
    beats: {
      place: { en: 'The place', fr: 'Le lieu', es: 'El lugar' },
      piece: { en: 'The work', fr: "L'œuvre", es: 'La obra' },
      alive: { en: 'The light', fr: 'La lumière', es: 'La luz' },
    },
    pieceNoun: 'sculpture',
    material: 'as in the reference, true material, texture and colour',
    animations: [
      { id: 'sun', label: { en: 'Late sun across it', fr: 'Soleil rasant', es: 'Sol rasante' }, prompt: 'warm late-afternoon sunlight raking across the sculpture, long soft shadows' },
      { id: 'evening', label: { en: 'Evening light', fr: 'Lumière du soir', es: 'Luz de la tarde' }, prompt: 'soft blue evening light, a single warm spotlight on the sculpture' },
    ],
    placeIdeas: [
      { id: 'living', label: { en: 'Living room', fr: 'Salon', es: 'Salón' }, prompt: 'A calm living room, a low plinth against a plain wall, soft morning light from the left' },
      { id: 'entrance', label: { en: 'Entrance', fr: 'Entrée', es: 'Entrada' }, prompt: 'A bright entrance hall, a narrow console against a plain wall, daylight' },
      { id: 'garden', label: { en: 'Garden', fr: 'Jardin', es: 'Jardín' }, prompt: 'A garden, a stone base on a lawn, blurred greenery behind, soft morning light' },
      { id: 'gallery', label: { en: 'Gallery', fr: 'Galerie', es: 'Galería' }, prompt: 'A white gallery room, a white plinth in the centre, even soft light, concrete floor' },
    ],
    clip: 'Slowly, {animation}, moving across the {piece} until the final frame. The {piece} itself does not move.',
    templates: {
      place: `{place}. ${PLACE_TAIL} No sculptures, no statues.`,
      piece: `Edit the first image. Place only the {piece} from the reference image on the surface, at a believable scale for the room, exactly as it is: {material}, same shape and proportions. ${ONLY_OBJECT} Match the room light and cast a soft natural shadow. ${KEEP}`,
      alive: 'Edit the first image. Change only the light: {animation}. The {piece} itself does not change. Same camera, same framing, the room stays where it is.',
    },
  },
  {
    id: 'painting',
    label: { en: 'Painting and illustration', fr: 'Peinture et illustration', es: 'Pintura e ilustración' },
    beats: {
      place: { en: 'The wall', fr: 'Le mur', es: 'La pared' },
      piece: { en: 'The work', fr: "L'œuvre", es: 'La obra' },
      alive: { en: 'The light', fr: 'La lumière', es: 'La luz' },
    },
    pieceNoun: 'painting',
    material: 'as in the reference, every colour, brushstroke and detail of the artwork unchanged',
    animations: [
      { id: 'sun', label: { en: 'Sun on the wall', fr: 'Soleil sur le mur', es: 'Sol en la pared' }, prompt: 'warm late-afternoon sunlight falling across the wall, soft window shadows' },
      { id: 'evening', label: { en: 'Evening lamp', fr: 'Lampe du soir', es: 'Lámpara de la tarde' }, prompt: 'evening, the room lit by a warm lamp, the painting softly lit' },
    ],
    placeIdeas: [
      { id: 'living', label: { en: 'Above the sofa', fr: 'Au-dessus du canapé', es: 'Sobre el sofá' }, prompt: 'A calm living room, a plain empty wall above a linen sofa, soft morning light from the left' },
      { id: 'bedroom', label: { en: 'Above the bed', fr: 'Au-dessus du lit', es: 'Sobre la cama' }, prompt: 'A quiet bedroom, a plain empty wall above a made bed, soft morning light' },
      { id: 'entrance', label: { en: 'Entrance', fr: 'Entrée', es: 'Entrada' }, prompt: 'A bright entrance hall, a plain empty wall above a narrow console, daylight' },
      { id: 'gallery', label: { en: 'Gallery', fr: 'Galerie', es: 'Galería' }, prompt: 'A white gallery room, a large plain empty white wall, even soft light, concrete floor' },
    ],
    clip: 'Slowly, {animation}, until the final frame. The {piece} on the wall does not change or move.',
    templates: {
      place: '{place}. The empty wall fills the upper two thirds of the frame. No pictures, no frames, no posters on the walls, no people. Natural film photography, 35mm, fine grain, quiet and minimal, editorial style. Eye-level, straight-on, locked camera.',
      piece: `Edit the first image. Hang only the {piece} from the reference image on the empty wall, centred, at a believable size for the room, flat against the wall, exactly as it is: {material}. ${ONLY_OBJECT} Match the room light, soft natural shadow under it. ${KEEP}`,
      alive: 'Edit the first image. Change only the light: {animation}. The {piece} itself does not change. Same camera, same framing, the room stays where it is.',
    },
  },
  {
    id: 'textile',
    label: { en: 'Textile and weaving', fr: 'Textile et tissage', es: 'Textil y tejido' },
    beats: {
      place: { en: 'The place', fr: 'Le lieu', es: 'El lugar' },
      piece: { en: 'Your creation', fr: 'Votre création', es: 'Tu creación' },
      alive: { en: 'In use', fr: 'La vie', es: 'En uso' },
    },
    pieceNoun: 'textile piece',
    material: 'as in the reference, true weave, texture and colours',
    animations: [
      { id: 'tea', label: { en: 'A book and a cup', fr: 'Un livre et une tasse', es: 'Un libro y una taza' }, prompt: 'an open book and a cup of tea beside it, as if someone just left' },
      { id: 'sun', label: { en: 'Morning sun', fr: 'Soleil du matin', es: 'Sol de la mañana' }, prompt: 'warm morning sunlight across it, showing the texture' },
    ],
    placeIdeas: [
      { id: 'sofa', label: { en: 'On a sofa', fr: 'Sur un canapé', es: 'En un sofá' }, prompt: 'A calm living room, a plain linen sofa against a plain wall, soft morning light from the left' },
      { id: 'bed', label: { en: 'On a bed', fr: 'Sur un lit', es: 'En una cama' }, prompt: 'A quiet bedroom, a made bed with plain white sheets, a plain wall, soft morning light' },
      { id: 'wall', label: { en: 'On a wall', fr: 'Au mur', es: 'En la pared' }, prompt: 'A calm room, a plain empty wall, a wooden floor, soft daylight' },
      { id: 'floor', label: { en: 'On the floor', fr: 'Au sol', es: 'En el suelo' }, prompt: 'A bright living room, an empty wooden floor in front of a plain wall, soft daylight' },
    ],
    clip: 'Slowly, {animation}, until the final frame. The {piece} itself does not move.',
    templates: {
      place: `{place}. ${PLACE_TAIL} No blankets, no rugs, no cushions.`,
      piece: `Edit the first image. Place only the {piece} from the reference image naturally in the scene (draped, laid or hung as such a piece would be), at a believable scale, exactly as it is: {material}. ${ONLY_OBJECT} Match the room light and soft natural shadows. ${KEEP}`,
      alive: 'Edit the first image. Add {animation}. The {piece} itself does not change. Same camera, same framing, the room stays where it is.',
    },
  },
  {
    id: 'products',
    label: { en: 'Other products', fr: 'Autres produits', es: 'Otros productos' },
    beats: {
      place: { en: 'The setting', fr: 'Le décor', es: 'El escenario' },
      piece: { en: 'The product', fr: 'Le produit', es: 'El producto' },
      alive: { en: 'The mood', fr: "L'ambiance", es: 'El ambiente' },
    },
    pieceNoun: 'product',
    // The packaging is what people recognise in a shop: its label and its text must not be redrawn.
    material: 'as in the reference, same packaging, same label, same colours, every printed word unchanged and readable',
    animations: [
      { id: 'water', label: { en: 'Water drops', fr: "Gouttes d'eau", es: 'Gotas de agua' }, prompt: 'fresh water droplets beading on it, a light splash of clear water beside it' },
      { id: 'foam', label: { en: 'Foam and bubbles', fr: 'Mousse et bulles', es: 'Espuma y burbujas' }, prompt: 'soft white foam and a few soap bubbles around it' },
      { id: 'ingredients', label: { en: 'Its ingredients', fr: 'Ses ingrédients', es: 'Sus ingredientes' }, prompt: 'a few of its natural ingredients scattered around it: herbs, flowers, citrus slices' },
      { id: 'chilled', label: { en: 'Chilled', fr: 'Bien frais', es: 'Bien frío' }, prompt: 'condensation on it and a few ice cubes around it, freshly chilled' },
    ],
    placeIdeas: [
      { id: 'bathroom', label: { en: 'Bathroom', fr: 'Salle de bain', es: 'Baño' }, prompt: 'A bathroom, a stone counter next to the basin, soft daylight' },
      { id: 'kitchen', label: { en: 'Kitchen', fr: 'Cuisine', es: 'Cocina' }, prompt: 'A kitchen, a clear wooden worktop against a plain wall, daylight from a window' },
      { id: 'outdoor', label: { en: 'Outdoors', fr: 'Extérieur', es: 'Exterior' }, prompt: 'An outdoor table in a garden, blurred greenery behind, soft morning light' },
      { id: 'studio', label: { en: 'Studio backdrop', fr: 'Fond studio', es: 'Fondo de estudio' }, prompt: 'A seamless studio backdrop in a soft neutral colour, a simple plinth, soft even light' },
      { id: 'shop', label: { en: 'Shop shelf', fr: 'Étagère de boutique', es: 'Estante de tienda' }, prompt: 'A small shop, an empty light wooden shelf against a plain wall, soft daylight' },
    ],
    clip: 'Slowly, {animation} appear around the {piece} until the final frame. The {piece} itself, its label and its text do not change or move.',
    templates: {
      place: `{place}. ${PLACE_TAIL} No bottles, no jars, no products.`,
      piece: `Edit the first image. Place only the {piece} from the reference image on the surface, near the centre, standing naturally, exactly as it is: {material}. ${ONLY_OBJECT} Match the light and cast a soft natural shadow. ${KEEP}`,
      alive: 'Edit the first image. Add {animation}. The {piece} itself, its label and its text do not change. Same camera, same framing, the setting stays where it is.',
    },
  },
];

export function profileById(id: string): TradeProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0]!;
}

/** The most characters the host's phrase matte takes in one phrase (doc 189 §5; the host's MAX_PHRASE_CHARS). */
export const MATTE_PHRASE_MAX = 120;

/**
 * What names the subject of each beat's picture, for the host's phrase matte
 * (doc 189 §5), in English like the prompts: the piece, and for the living beat
 * what was added too (the plant, the animal). The host cuts the union of what
 * the phrases find, so a phrase that names no object (a lamp's « warm light at
 * dusk ») simply finds nothing.
 *
 * The trade's `aliveNoun` is named too, on every living cut. A trade without one
 * names only a companion: its animations are lights as often as objects.
 *
 * 🚨 When nothing names what the living beat added (no animation, a sentence
 * longer than a phrase, and no `aliveNoun`), that beat sends NO phrase and the
 * host's salient matte cuts it as before. Naming the piece alone there would
 * lift the pot and drop the plant: 9 of Atelier Rosalie's 10 scenes have no
 * animation id (measured 2026-10-28, doc 189 §5).
 */
export function mattePhrases(profile: TradeProfile, animation: string): Record<'piece' | 'alive', string[]> {
  const piece = `the ${profile.pieceNoun}`;
  const companion = companionOf(profile, animation)?.prompt;
  // A trade's animation is often a LIGHT (« its warm light at night, the room dark
  // around it »): as a phrase it could name the whole room. Only a companion (always
  // a creature) or a trade that declares what its living beat adds is named.
  const words = (companion ?? (profile.aliveNoun ? (profile.animations.find((a) => a.id === animation)?.prompt ?? animation) : '')).trim();
  const added = [words && words.length <= MATTE_PHRASE_MAX ? words : '', profile.aliveNoun ?? ''].filter(Boolean);
  return { piece: [piece], alive: added.length > 0 ? [piece, ...added] : [] };
}

/**
 * A scene's phrases, under the trade the scene was MADE in: changing the trade
 * in the settings must not rename a piece half made (the doc 145 rule of `profileId`).
 */
export function scenePhrases(scene: Pick<Scene, 'profileId' | 'animation'>, settingsProfileId: string): Record<'piece' | 'alive', string[]> {
  return mattePhrases(profileById(scene.profileId ?? settingsProfileId), scene.animation);
}

/** Fills {holes}. A hole with no value stays visible in the prompt rather than becoming an empty word. */
export function fillTemplate(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = values[key]?.trim();
    return v ? v : whole;
  });
}

export interface PromptInput {
  profile: TradeProfile;
  placeDescription: string;
  /** The piece's own description, when the person wrote one. */
  pieceDescription?: string;
  /** An animation id from the profile, or the person's own words. */
  animation: string;
}

/** The three prompts of a scene. */
export function promptsFor(input: PromptInput): Record<Beat, string> {
  const { profile } = input;
  const companion = companionOf(profile, input.animation);
  const animation = companion?.prompt ?? profile.animations.find((a) => a.id === input.animation)?.prompt ?? input.animation;
  const values = {
    place: input.placeDescription,
    piece: profile.pieceNoun,
    // The person's words about THEIR piece beat the trade's default.
    material: input.pieceDescription?.trim() || profile.material,
    animation,
  };
  return {
    place: fillTemplate(profile.templates.place, values),
    piece: fillTemplate(profile.templates.piece, values),
    alive: fillTemplate(companion ? COMPANION_ALIVE : profile.templates.alive, values),
  };
}

/** What every clip must not do, whatever the trade. */
export const CLIP_NEGATIVE = 'camera movement, zoom, pan, cut, scene change, text, watermark, people, hands, glossy CGI, 3D render, flicker, morphing background';
const CLIP_CAMERA: Record<ClipCamera, string> = {
  still: ' Locked camera on a tripod, no camera movement.',
  push: ' The camera pushes in very slowly and smoothly toward the {piece}; nothing else about the camera changes.',
  pan: ' The camera pans very slowly and smoothly from left to right, staying level.',
};
const CLIP_LIGHT: Record<ClipLight, string> = {
  steady: ' The room, the furniture and the light stay identical.',
  sun: ' The room and the furniture stay identical; soft sunlight drifts slowly across the wall.',
};
/** The end of every clip prompt: how the camera and the light move, then the person's own word. Still and steady by default. */
function clipTail(profile: TradeProfile, style: ClipStyle | undefined): string {
  const camera = CLIP_CAMERA[style?.camera ?? 'still'].replace('{piece}', profile.pieceNoun);
  const note = style?.note?.trim();
  return camera + CLIP_LIGHT[style?.light ?? 'steady'] + ' Natural, calm, photographic.' + (note ? ` ${note}` : '');
}

/** The clip prompt of a scene. */
export function clipPrompt(profile: TradeProfile, animation: string, style?: ClipStyle): string {
  const companion = companionOf(profile, animation);
  const words = companion?.prompt ?? profile.animations.find((a) => a.id === animation)?.prompt ?? animation;
  return fillTemplate(companion ? COMPANION_CLIP : profile.clip, { piece: profile.pieceNoun, animation: words }) + clipTail(profile, style);
}

/** What the clip must not do; a child in the scene lifts the ban on people and hands. */
export function clipNegative(profile: TradeProfile, animation: string): string {
  return companionOf(profile, animation)?.person ? CLIP_NEGATIVE.replace('people, hands, ', '') : CLIP_NEGATIVE;
}
