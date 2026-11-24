"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchPlaces } from "@/lib/fuzzy-search";
import { categoryVisual } from "@/lib/category-visual";
import { formatDistance } from "@/lib/geo";
import { CategoryIcon } from "./category-icon";
import type { SingularPlaceDTO } from "@/lib/place-types";

type PlaceFinderProps = {
  /** Catálogo ya cargado (la búsqueda corre 100% en el cliente). */
  places: SingularPlaceDTO[];
  /** El usuario eligió un resultado de la lista de sugerencias. */
  onPick: (place: SingularPlaceDTO) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Buscador «como suena» para la ventana del mapa (petición de la dueña,
 * 24-nov-2026): el usuario escribe el nombre del lugar exacto, parcial o
 * como lo ESCUCHÓ — sin necesidad de ortografía perfecta — y elige un
 * resultado de la lista desplegable. Usa el motor difuso de
 * `src/lib/fuzzy-search.ts` (mismo motor que la lista de Lugares).
 *
 * Accesible: combobox ARIA con navegación por teclado (flechas + Enter +
 * Escape) y objetivos táctiles de 44px. El estado de apertura es derivado
 * (focus + texto), sin efectos de sincronización.
 */
export function PlaceFinder({
  places,
  onPick,
  placeholder = "¿A dónde vas? Escríbelo como suena",
  className = "",
}: PlaceFinderProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? searchPlaces(places, trimmed, 6) : []),
    [places, trimmed]
  );
  const open = focused && trimmed.length > 0;
  const activeIdx = Math.min(active, Math.max(0, results.length - 1));

  // Un clic fuera de la caja cierra las sugerencias.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (place: SingularPlaceDTO) => {
    setQuery("");
    setActive(0);
    setFocused(false);
    inputRef.current?.blur();
    onPick(place);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (open && results.length > 0) {
        setActive((a) => (a + 1) % results.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open && results.length > 0) {
        setActive((a) => (a - 1 + results.length) % results.length);
      }
    } else if (e.key === "Enter") {
      if (open && results.length > 0) {
        e.preventDefault();
        const target = results[activeIdx] ?? results[0];
        if (target) pick(target);
      }
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setActive(0);
        setFocused(false);
      } else {
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div ref={wrapRef} className={"relative " + className}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results.length > 0 ? `${listId}-${activeIdx}` : undefined
          }
          spellCheck={false}
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            // Si el foco se mueve dentro de la caja (p. ej. al botón de
            // limpiar), mantener las sugerencias; si sale, cerrarlas.
            if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
            setFocused(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Buscar lugar por nombre, parcial o como suena"
          className="h-11 rounded-xl border-stone-200 bg-white/97 pl-9 pr-9 text-sm shadow-md backdrop-blur focus-visible:ring-emerald-600"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setActive(0);
              setFocused(false);
            }}
            aria-label="Limpiar búsqueda"
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          id={listId}
          aria-label="Resultados de la búsqueda"
          className="rv-scroll absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl"
        >
          {results.length === 0 ? (
            <div className="p-3.5">
              <p className="text-sm font-semibold text-stone-700">
                No encontramos «{trimmed}»
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Escribe una parte del nombre o como lo escuchaste: la búsqueda
                tolera la ortografía («sin pedrito» sí encuentra San Pedrito).
              </p>
            </div>
          ) : (
            <ul>
              {results.map((p, i) => {
                const cat = categoryVisual(p.category);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-${i}`}
                      aria-selected={i === activeIdx}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(p)}
                      onMouseEnter={() => setActive(i)}
                      className={
                        "flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left transition " +
                        (i === activeIdx ? "bg-emerald-50" : "hover:bg-emerald-50/60")
                      }
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{ background: cat.bg, color: cat.fg }}
                        aria-hidden
                      >
                        <CategoryIcon category={p.category} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block line-clamp-1 text-sm font-semibold text-stone-800">
                          {p.name}
                        </span>
                        <span className="block text-xs text-stone-500">
                          {p.categoryLabel}
                          {p.address ? ` · ${p.address}` : ""}
                        </span>
                      </span>
                      {p.distanceKm != null ? (
                        <span className="shrink-0 text-xs font-semibold text-emerald-700">
                          {formatDistance(p.distanceKm)}
                        </span>
                      ) : (
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-300" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
