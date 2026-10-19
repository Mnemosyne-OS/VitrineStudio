import { BookOpen, Clapperboard, FileText, LayoutGrid, SquarePen, type LucideIcon } from 'lucide-react';
import type { PageType } from '../model/pages';

/** Each page model, by its icon (a module of its own: a .tsx exporting a value beside a component breaks Fast Refresh). */
export const PAGE_ICON: Record<PageType, LucideIcon> = { scenes: Clapperboard, blog: BookOpen, catalogue: LayoutGrid, text: FileText, form: SquarePen };
