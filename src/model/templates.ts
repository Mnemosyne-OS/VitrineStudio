import type { PageLayout } from './pages';

type L10n = { en: string; fr: string; es: string };
const L = (en: string, fr: string, es: string): L10n => ({ en, fr, es });

/**
 * Pages that start written, so nobody faces a blank page (asked for on 02/11:
 * start from a model, then change it as one likes).
 * A model is only offered on an empty page or a new post: it never replaces
 * words she wrote. Its brackets are what she replaces with her own.
 */
export interface TextTemplate {
  id: string;
  name: L10n;
  /** Where the picture stands, for a page; absent for a post. */
  layout?: PageLayout;
  /** A page model's empty photo frames beside the portrait (About only); absent = none. */
  photos?: number;
  /** Markdown, in the studio's language. */
  text: L10n;
}

export const PAGE_TEMPLATES: readonly TextTemplate[] = [
  {
    id: 'story', layout: 'right', photos: 2,
    name: L('Portrait and story', 'Portrait et histoire', 'Retrato e historia'),
    text: L(
      '## Hello, I am [your first name]\n\n[Two or three sentences: who you are, where your workshop is, since when you make what you make.]\n\n## How I work\n\n[Your material, your gestures, what takes time. One paragraph is enough.]\n\n## Where to find my pieces\n\n[Your markets, your shop, or simply: write to me.]',
      '## Bonjour, je suis [votre prénom]\n\n[Deux ou trois phrases : qui vous êtes, où est votre atelier, depuis quand vous faites ce que vous faites.]\n\n## Ma façon de travailler\n\n[Votre matière, vos gestes, ce qui prend du temps. Un paragraphe suffit.]\n\n## Où trouver mes pièces\n\n[Vos marchés, votre boutique, ou simplement : écrivez-moi.]',
      '## Hola, soy [tu nombre]\n\n[Dos o tres frases: quién eres, dónde está tu taller, desde cuándo haces lo que haces.]\n\n## Mi forma de trabajar\n\n[Tu material, tus gestos, lo que lleva tiempo. Un párrafo basta.]\n\n## Dónde encontrar mis piezas\n\n[Tus mercados, tu tienda o simplemente: escríbeme.]',
    ),
  },
  {
    id: 'workshop', layout: 'top', photos: 3,
    name: L('The workshop first', "L'atelier d'abord", 'Primero el taller'),
    text: L(
      '## The workshop\n\n[Describe the place: the light, the smell, the tools on the bench.]\n\n## What comes out of it\n\n[The pieces you make, and the one you prefer.]',
      "## L'atelier\n\n[Décrivez le lieu : la lumière, l'odeur, les outils sur l'établi.]\n\n## Ce qui en sort\n\n[Les pièces que vous faites, et celle que vous préférez.]",
      '## El taller\n\n[Describe el lugar: la luz, el olor, las herramientas en el banco.]\n\n## Lo que sale de él\n\n[Las piezas que haces, y la que prefieres.]',
    ),
  },
  {
    id: 'short', layout: 'bottom', photos: 1,
    name: L('A few words', 'Quelques mots', 'Unas palabras'),
    text: L(
      '[One sentence about you and your craft.]\n\n[One sentence about what makes your pieces yours.]',
      '[Une phrase sur vous et votre métier.]\n\n[Une phrase sur ce qui rend vos pièces à vous.]',
      '[Una frase sobre ti y tu oficio.]\n\n[Una frase sobre lo que hace tuyas tus piezas.]',
    ),
  },
];

export const POST_TEMPLATES: readonly TextTemplate[] = [
  {
    id: 'piece',
    name: L('A new piece', 'Une nouvelle pièce', 'Una pieza nueva'),
    text: L(
      '![The piece](photo:slot "full")\n\n[Where the idea came from, in two sentences.]\n\n![In the making](photo:slot "left")\n\n## How it was made\n\n[The steps, the surprise, the time it took.]\n\n## Its place at home\n\n[Where it looks best, what goes in it.]',
      "![La pièce](photo:slot \"full\")\n\n[D'où vient l'idée, en deux phrases.]\n\n![En cours de fabrication](photo:slot \"left\")\n\n## Comment elle est née\n\n[Les étapes, la surprise, le temps que ça a pris.]\n\n## Sa place à la maison\n\n[Où elle est la plus belle, ce qu'on y met.]",
      '![La pieza](photo:slot "full")\n\n[De dónde viene la idea, en dos frases.]\n\n![En proceso](photo:slot "left")\n\n## Cómo nació\n\n[Los pasos, la sorpresa, el tiempo que llevó.]\n\n## Su lugar en casa\n\n[Dónde luce más, qué se pone en ella.]',
    ),
  },
  {
    id: 'behind',
    name: L('In the workshop', "Dans l'atelier", 'En el taller'),
    text: L(
      '![The bench this week](photo:slot "full")\n\n[What you are working on this week.]\n\n![The gesture](photo:slot "right")\n\n## A gesture\n\n[One technique explained simply, as to a curious visitor.]',
      '![L\'établi cette semaine](photo:slot "full")\n\n[Ce sur quoi vous travaillez cette semaine.]\n\n![Le geste](photo:slot "right")\n\n## Un geste\n\n[Une technique expliquée simplement, comme à un visiteur curieux.]',
      '![El banco esta semana](photo:slot "full")\n\n[En qué trabajas esta semana.]\n\n![El gesto](photo:slot "right")\n\n## Un gesto\n\n[Una técnica explicada con sencillez, como a un visitante curioso.]',
    ),
  },
  {
    id: 'market',
    name: L('A market, an event', 'Un marché, un événement', 'Un mercado, un evento'),
    text: L(
      '## [Name of the market]\n\n![The stall](photo:slot "full")\n\n**When:** [day and hours]  \n**Where:** [place]\n\n[What you will bring, and a word for those who come.]',
      '## [Nom du marché]\n\n![Le stand](photo:slot "full")\n\n**Quand :** [jour et heures]  \n**Où :** [lieu]\n\n[Ce que vous apporterez, et un mot pour ceux qui viennent.]',
      '## [Nombre del mercado]\n\n![El puesto](photo:slot "full")\n\n**Cuándo:** [día y horas]  \n**Dónde:** [lugar]\n\n[Lo que llevarás, y unas palabras para quien venga.]',
    ),
  },
];

/** A model's words in the studio's language; English when the language has none. */
export function templateText(tpl: TextTemplate, lang: string): string {
  return tpl.text[lang as keyof L10n] ?? tpl.text.en;
}

export function templateName(tpl: TextTemplate, lang: string): string {
  return tpl.name[lang as keyof L10n] ?? tpl.name.en;
}
