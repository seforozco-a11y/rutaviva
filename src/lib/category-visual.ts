/**
 * Visuales por categoría de lugar singular: icono SVG (trazos de lucide,
 * ISC License — lucide.dev) + colores propios de cada categoría.
 *
 * Fuente única de verdad: el mismo markup SVG alimenta
 *  - el componente React <CategoryIcon /> (tarjetas, hoja de detalle), y
 *  - los pines DivIcon de Leaflet (mapa), vía categorySvg().
 */

export type CategoryVisual = {
  /** Trazos internos del icono (viewBox 24×24, stroke). */
  svg: string;
  /** Color principal de la categoría (pin del mapa, icono). */
  fg: string;
  /** Fondo suave para chips y badges. */
  bg: string;
};

export const CATEGORY_VISUALS = {
  playa: {
    svg: '<path d="M22 12a10.06 10.06 1 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>',
    fg: "#0e7490",
    bg: "#cffafe",
  },
  naturaleza: {
    svg: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>',
    fg: "#15803d",
    bg: "#dcfce7",
  },
  mirador: {
    svg: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    fg: "#6d28d9",
    bg: "#ede9fe",
  },
  monumento: {
    svg: '<path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/>',
    fg: "#b45309",
    bg: "#fef3c7",
  },
  plaza: {
    svg: '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/><path d="M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5Z"/>',
    fg: "#be185d",
    bg: "#fce7f3",
  },
  gastronomia: {
    svg: '<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>',
    fg: "#ea580c",
    bg: "#ffedd5",
  },
  museo: {
    svg: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    fg: "#334155",
    bg: "#e2e8f0",
  },
  parque: {
    svg: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>',
    fg: "#4d7c0f",
    bg: "#ecfccb",
  },
  cultura: {
    svg: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
    fg: "#a21caf",
    bg: "#fae8ff",
  },
  otro: {
    svg: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    fg: "#57534e",
    bg: "#f5f5f4",
  },
} satisfies Record<string, CategoryVisual>;

export type CategoryVisualId = keyof typeof CATEGORY_VISUALS;

/** Visual de una categoría; cae a "otro" si el id no existe (datos viejos). */
export function categoryVisual(categoryId: string | null | undefined): CategoryVisual {
  return (
    (categoryId && CATEGORY_VISUALS[categoryId as CategoryVisualId]) ||
    CATEGORY_VISUALS.otro
  );
}

/**
 * SVG completo de la categoría como string (para DivIcon de Leaflet y
 * otros contextos sin React). Hereda color por `currentColor` a menos
 * que se pase `style` con un color explícito.
 */
export function categorySvg(
  categoryId: string | null | undefined,
  opts?: { className?: string; style?: string }
): string {
  const v = categoryVisual(categoryId);
  const cls = opts?.className ? ` class="${opts.className}"` : "";
  const style = opts?.style ? ` style="${opts.style}"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls}${style}>${v.svg}</svg>`;
}
