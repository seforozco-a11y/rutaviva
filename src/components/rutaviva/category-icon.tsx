import { categoryVisual } from "@/lib/category-visual";

type CategoryIconProps = {
  /** Id de la categoría (playa, mirador, …). Desconocida → "otro". */
  category?: string | null;
  className?: string;
};

/**
 * Icono de la categoría de un lugar singular (misma fuente de datos que
 * los pines del mapa). El color se hereda por `currentColor`.
 */
export function CategoryIcon({ category, className }: CategoryIconProps) {
  const v = categoryVisual(category);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <g dangerouslySetInnerHTML={{ __html: v.svg }} />
    </svg>
  );
}
