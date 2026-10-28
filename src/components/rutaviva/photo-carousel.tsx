"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type PhotoCarouselProps = {
  images: string[];
  alt: string;
  /** Se ejecuta al tocar una foto (visor a pantalla completa). */
  onOpenPhoto?: (url: string, alt: string) => void;
};

/**
 * Carrusel de fotos del lugar para la hoja de detalle:
 *  - Swipe táctil horizontal con scroll-snap nativo (el dedo arrastra la foto,
 *    sin afectar el scroll vertical de la hoja).
 *  - Auto-avance en bucle mientras la ventana esté abierta: la primera foto
 *    3 segundos y las demás 2 segundos; al llegar a la última reinicia.
 *  - Se pausa mientras el usuario explora con el dedo y retoma desde la foto
 *    visible al soltar.
 *  - Puntos indicadores, contador y botones prev/next (accesible).
 */
export function PhotoCarousel({ images, alt, onOpenPhoto }: PhotoCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const dragging = useRef(false);
  /** Límite temporal mientras corre un scroll programático (evita parpadeo del índice). */
  const programmaticUntil = useRef(0);
  const [index, setIndex] = useState(0);
  // Bump para reagendar el auto-avance tras una interacción manual.
  const [tick, setTick] = useState(0);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      const n = images.length;
      if (n === 0) return;
      const next = ((i % n) + n) % n;
      programmaticUntil.current = Date.now() + 650; // duración del smooth scroll
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
      setIndex(next);
    },
    [images.length]
  );

  // Auto-avance: portada 3 s, resto 2 s. `index`/`tick` reagendan el ciclo.
  useEffect(() => {
    if (images.length <= 1) return;
    const t = setTimeout(
      () => {
        if (!dragging.current) goTo(index + 1);
      },
      index === 0 ? 3000 : 2000
    );
    return () => clearTimeout(t);
  }, [index, tick, images.length, goTo]);

  // Índice actual según la posición del scroll (rAF para no inundar a React).
  const handleScroll = useCallback(() => {
    // Durante un avance programático el índice ya lo fija goTo; los eventos
    // intermedios de la animación ignoran la posición parcial.
    if (Date.now() < programmaticUntil.current) return;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const track = trackRef.current;
      if (!track || track.clientWidth === 0) return;
      const i = Math.round(track.scrollLeft / track.clientWidth);
      setIndex(Math.min(Math.max(i, 0), images.length - 1));
    });
  }, [images.length]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="rv-scroll flex h-44 snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={handleScroll}
        onTouchStart={() => {
          dragging.current = true;
          // Un toque manual cancela cualquier avance/animación en curso.
          programmaticUntil.current = 0;
        }}
        onTouchEnd={() => {
          dragging.current = false;
          setTick((t) => t + 1);
        }}
        role="group"
        aria-label={`${alt}: galería de ${images.length} fotos`}
      >
        {images.map((url, i) => (
          <button
            key={`${i}-${url.slice(-24)}`}
            type="button"
            onClick={() => onOpenPhoto?.(url, `${alt} · foto ${i + 1} de ${images.length}`)}
            className="w-full shrink-0 snap-center"
            aria-label={`Ver foto ${i + 1} de ${images.length}`}
          >
            <img
              src={url}
              alt={`${alt} · foto ${i + 1}`}
              className="h-44 w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* Contador */}
      <span
        className="absolute right-2 top-2 rounded-full bg-stone-900/60 px-2 py-0.5 text-[11px] font-bold text-white shadow"
        aria-live="polite"
      >
        {index + 1}/{images.length}
      </span>

      {/* Flechas (escritorio) */}
      <button
        type="button"
        onClick={() => goTo(index - 1)}
        aria-label="Foto anterior"
        className="absolute left-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow-md backdrop-blur transition hover:bg-white md:flex"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => goTo(index + 1)}
        aria-label="Foto siguiente"
        className="absolute right-1 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow-md backdrop-blur transition hover:bg-white md:flex"
      >
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>

      {/* Puntos indicadores */}
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir a la foto ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-white shadow" : "w-1.5 bg-white/60 hover:bg-white/90"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
