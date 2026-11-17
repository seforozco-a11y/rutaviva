"use client";

import { useEffect, useState, type RefObject } from "react";
import { ChevronsLeft, ChevronsLeftRight, ChevronsRight } from "lucide-react";

/**
 * Pista de deslizamiento horizontal para las franjas del mapa (chips de
 * categorías y tarjetas de lugares). Se muestra SOLO mientras queda
 * contenido fuera de vista y el texto se adapta al caso:
 *  - queda contenido a la derecha   → «Desliza a la derecha»
 *  - queda contenido a la izquierda → «Desliza a la izquierda»
 *  - queda en ambos lados           → «Desliza a la derecha o a la izquierda»
 * Así el usuario descubre por sí mismo los elementos que no están visibles,
 * y la pista se apaga sola cuando todo el contenido cabe en la pantalla.
 */
export function ScrollHint({ target }: { target: RefObject<HTMLElement | null> }) {
  const [edges, setEdges] = useState({ left: false, right: false });

  // Se registra tras CADA render (sin deps): la medición queda diferida a
  // requestAnimationFrame — evita setState síncrono en el efecto (cascada
  // de renders) y garantiza que un cambio de contenido (filtro, carga de
  // lugares) siempre re-mida, aunque el tamaño del contenedor no cambie.
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setEdges((p) => (p.left === left && p.right === right ? p : { left, right }));
    };
    const raf = requestAnimationFrame(measure);
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  });

  if (!edges.left && !edges.right) return null;

  const label =
    edges.right && edges.left
      ? "Desliza a la derecha o a la izquierda"
      : edges.right
        ? "Desliza a la derecha"
        : "Desliza a la izquierda";
  const Icon = edges.right && edges.left ? ChevronsLeftRight : edges.right ? ChevronsRight : ChevronsLeft;

  return (
    <div className="flex justify-center">
      <div className="pointer-events-none inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-900/10 bg-white/95 px-2.5 py-1 text-[10px] font-bold text-emerald-900 shadow-md backdrop-blur">
        <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
        <span className="whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
}
