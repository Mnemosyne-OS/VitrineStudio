/**
 * Interior styles, offered as tiles on the place step (doc 145 §10.5).
 *
 * Shared by every trade: a lamp maker and a potter both sell into a Swiss
 * minimal flat or a Mediterranean house. Data, never a branch: a new style is
 * a new entry. `prompt` is English (the image model follows English best);
 * `swatch` is three colours the tile shows so the style reads before its name.
 */
import type { Lang } from './profiles';

export interface InteriorStyle {
  id: string;
  label: Record<Lang, string>;
  prompt: string;
  swatch: [string, string, string];
}

export const STYLES: InteriorStyle[] = [
  { id: 'swiss', label: { en: 'Swiss interior design', fr: 'Design intérieur suisse', es: 'Diseño interior suizo' }, prompt: 'Swiss interior design: clean lines, white and light grey surfaces, pale ash wood, precise, calm and uncluttered', swatch: ['#F2F1EE', '#D9D7D2', '#C9B79C'] },
  { id: 'natural-wood', label: { en: 'Natural wood', fr: 'Bois naturel', es: 'Madera natural' }, prompt: 'natural wood interior: warm oak and walnut, linen textiles, soft daylight', swatch: ['#E8DCC8', '#B98D5E', '#6E4B2E'] },
  { id: 'japandi', label: { en: 'Japandi', fr: 'Japandi', es: 'Japandi' }, prompt: 'Japandi interior: low furniture, pale wood, washi paper light, muted beige and charcoal, very calm', swatch: ['#EDE7DD', '#B7A68E', '#3E3B37'] },
  { id: 'scandinavian', label: { en: 'Scandinavian', fr: 'Scandinave', es: 'Escandinavo' }, prompt: 'Scandinavian interior: white walls, light birch wood, soft wool textures, bright northern light', swatch: ['#FAFAF8', '#E3D9C6', '#9FB1B8'] },
  { id: 'mediterranean', label: { en: 'Mediterranean', fr: 'Méditerranéen', es: 'Mediterráneo' }, prompt: 'Mediterranean interior: limewashed walls, terracotta floor, raw linen, warm sun through a window', swatch: ['#F1E6D6', '#D59A6E', '#7E9C8C'] },
  { id: 'wabi-sabi', label: { en: 'Wabi-sabi', fr: 'Wabi-sabi', es: 'Wabi-sabi' }, prompt: 'wabi-sabi interior: raw plaster walls, imperfect textures, aged wood, soft shadows, quiet and earthy', swatch: ['#D8CFC2', '#A39481', '#5D5248'] },
  { id: 'soft-industrial', label: { en: 'Soft industrial', fr: 'Industriel doux', es: 'Industrial suave' }, prompt: 'soft industrial interior: polished concrete, thin black steel, warm light, a few wooden touches', swatch: ['#CFCCC7', '#8C8883', '#2F2E2C'] },
  { id: 'bohemian', label: { en: 'Bohemian', fr: 'Bohème', es: 'Bohemio' }, prompt: 'bohemian interior: rattan, woven textiles, warm earthy colours, relaxed and lived-in', swatch: ['#EBD9BF', '#C08A55', '#7A5C3E'] },
  { id: 'minimalist', label: { en: 'Minimalist', fr: 'Minimaliste', es: 'Minimalista' }, prompt: 'minimalist interior: bare white walls, almost no objects, one soft light source, pure and quiet', swatch: ['#FFFFFF', '#E6E6E3', '#B5B3AE'] },
  { id: 'art-deco', label: { en: 'Art deco', fr: 'Art déco', es: 'Art déco' }, prompt: 'art deco interior: deep green and brass, geometric patterns, curved velvet, polished marble, elegant warm light', swatch: ['#1F4A3F', '#C9A44C', '#E8E1D3'] },
  { id: 'rustic', label: { en: 'Country', fr: 'Campagne', es: 'Rústico' }, prompt: 'country house interior: old stone walls, thick wooden beams, worn tiles, warm and simple', swatch: ['#D9CBB4', '#9C7A55', '#5B4632'] },
  { id: 'mid-century', label: { en: 'Mid-century', fr: 'Vintage années 60', es: 'Años 60' }, prompt: 'mid-century modern interior: teak furniture with tapered legs, mustard and olive accents, warm 1960s light', swatch: ['#E9D8B4', '#B9772F', '#5E6B3A'] },
  { id: 'coastal', label: { en: 'Coastal', fr: 'Bord de mer', es: 'Costero' }, prompt: 'coastal interior: whitewashed wood, pale blue and sand tones, light linen, airy seaside light', swatch: ['#F4F1EA', '#CFC2A8', '#8FB2C4'] },
  { id: 'modern-luxury', label: { en: 'Modern luxury', fr: 'Luxe moderne', es: 'Lujo moderno' }, prompt: 'modern luxury interior: travertine, smoked oak, bronze details, soft indirect lighting, refined and calm', swatch: ['#E7DCCB', '#8E7A63', '#3A322B'] },
];

/** The place description from a room idea and a style, either of which may be absent. */
export function composePlace(roomPrompt: string | undefined, stylePrompt: string | undefined): string {
  return [roomPrompt, stylePrompt].filter((p): p is string => !!p && !!p.trim()).join('. ');
}
