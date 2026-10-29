"use client";

import { useMemo, useState } from "react";
import { MapPin, RotateCcw, Search, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryVisual } from "@/lib/category-visual";
import { CategoryIcon } from "./category-icon";
import { PrivacyNotice } from "./privacy-notice";
import {
  COMMON_TYPES,
  SINGULAR_CATEGORIES,
  commonTypeById,
  formatDistance,
} from "@/lib/geo";
import type {
  Coordinates,
  NearbyPlaceDTO,
  PlaceDetail,
  SingularPlaceDTO,
} from "@/lib/place-types";

type PlacesListProps = {
  origin: Coordinates | null;
  places: SingularPlaceDTO[];
  placesLoading: boolean;
  placesError: string | null;
  nearby: NearbyPlaceDTO[];
  nearbyLoading: boolean;
  nearbyError: string | null;
  tab: "singulares" | "servicios";
  onTabChange: (tab: "singulares" | "servicios") => void;
  onFlyTo: (c: Coordinates) => void;
  onSelect: (d: PlaceDetail) => void;
  onRetryPlaces: () => void;
  onRetryNearby: () => void;
};

export function PlacesList({
  origin,
  places,
  placesLoading,
  placesError,
  nearby,
  nearbyLoading,
  nearbyError,
  tab,
  onTabChange,
  onFlyTo,
  onSelect,
  onRetryPlaces,
  onRetryNearby,
}: PlacesListProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = places;
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)
    );
  }, [places, query, category]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-stone-800">Lugares</h1>
        <p className="text-sm text-stone-500">
          {origin
            ? "Ordenados por cercanía a tu ubicación."
            : "Activa tu ubicación para ver distancias."}
        </p>
      </header>

      {/* Segmentado */}
      <div
        role="tablist"
        aria-label="Tipo de lugares"
        className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1"
      >
        {(
          [
            ["singulares", "Singulares"],
            ["servicios", "Servicios"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => onTabChange(id)}
            className={
              "min-h-[40px] rounded-xl text-sm font-bold transition " +
              (tab === id
                ? "bg-white text-emerald-700 shadow"
                : "text-stone-500 hover:text-stone-700")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Buscador (solo singulares) */}
      {tab === "singulares" && (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o categoría…"
              aria-label="Buscar lugares singulares"
              className="h-11 rounded-xl border-stone-200 bg-white pl-9 focus-visible:ring-emerald-600"
            />
          </div>

          <div className="rv-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Chip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="Todas"
            />
            {SINGULAR_CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                active={category === c.id}
                onClick={() => setCategory(c.id)}
                label={c.label}
              />
            ))}
          </div>

          {placesLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : placesError ? (
            <ErrorBox message={placesError} onRetry={onRetryPlaces} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              text="Prueba con otra búsqueda o quita el filtro de categoría."
            />
          ) : (
            <ul className="space-y-3">
              {filtered.map((p) => {
                const cat = categoryVisual(p.category);
                return (
                <li key={p.id}>
                  <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-bold leading-snug text-stone-800">
                        {p.name}
                      </h2>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        className="gap-1 border-0 hover:opacity-90"
                        style={{ background: cat.bg, color: cat.fg }}
                      >
                        <CategoryIcon category={p.category} className="h-3 w-3" />
                        {p.categoryLabel}
                      </Badge>
                      {p.ratingCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                          <Star
                            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                            aria-hidden
                          />
                          {(p.ratingAvg ?? 0).toFixed(1)} ({p.ratingCount})
                        </span>
                      )}
                      {p.distanceKm != null && (
                        <span className="text-xs font-semibold text-emerald-700">
                          a {formatDistance(p.distanceKm)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-500">
                      {p.description}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        onFlyTo({ lat: p.lat, lng: p.lng });
                        onSelect({
                          kind: "singular",
                          id: p.id,
                          name: p.name,
                          lat: p.lat,
                          lng: p.lng,
                          distanceKm: p.distanceKm,
                          category: p.category,
                          categoryLabel: p.categoryLabel,
                          description: p.description,
                          address: p.address,
                          tips: p.tips,
                          imageUrl: p.imageUrl,
                        });
                      }}
                      className="mt-3 h-9 w-full gap-1.5 bg-emerald-700 hover:bg-emerald-800"
                    >
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      Ver en mapa
                    </Button>
                  </article>
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Servicios (OSM en vivo) */}
      {tab === "servicios" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Lugares comunes de OpenStreetMap a ~1.5 km de ti, en vivo y sin límite de catálogo.
          </p>
          {!origin ? (
            <EmptyState
              title="Falta tu ubicación"
              text="Usa el botón de centrar en el mapa o vuelve a la portada para activar el GPS."
            />
          ) : (
            COMMON_TYPES.map((t) => (
              <ServiceRow
                key={t.id}
                type={t}
                places={nearby.filter((n) => n.type === t.id)}
                loading={nearbyLoading}
                onOpen={(n) =>
                  onSelect({
                    kind: "common",
                    id: n.id,
                    name: n.name,
                    lat: n.lat,
                    lng: n.lng,
                    distanceKm: n.distanceKm,
                    categoryLabel: t.label,
                    color: t.color,
                  })
                }
              />
            ))
          )}
          {nearbyError && (
            <ErrorBox
              message={nearbyError}
              onRetry={onRetryNearby}
            />
          )}
        </div>
      )}

      {/* Aviso de privacidad: reglas de fotos y contenido para la comunidad */}
      <PrivacyNotice
        className="mt-2 flex w-full items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-stone-800">Aviso de privacidad</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
            Qué podemos y qué no podemos hacer con las fotos y la información que se comparte en
            RutaViva. Aplica a viajeros y administradores.
          </span>
        </span>
      </PrivacyNotice>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "min-h-[34px] shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition " +
        (active
          ? "border-emerald-700 bg-emerald-700 text-white shadow"
          : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-700")
      }
    >
      {label}
    </button>
  );
}

function ServiceRow({
  type,
  places,
  loading,
  onOpen,
}: {
  type: (typeof COMMON_TYPES)[number];
  places: NearbyPlaceDTO[];
  loading: boolean;
  onOpen: (n: NearbyPlaceDTO) => void;
}) {
  const near = [...places].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full border border-white shadow"
          style={{ background: type.color }}
          aria-hidden
        />
        <h2 className="text-sm font-bold text-stone-800">{type.label}</h2>
        <span className="ml-auto text-xs font-medium text-stone-400">
          {loading ? "cargando…" : `${places.length} cerca de ti`}
        </span>
      </div>
      {!loading && near.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {near.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-emerald-50"
              >
                <span className="line-clamp-1 text-sm font-medium text-stone-700">{n.name}</span>
                <span className="shrink-0 text-xs font-semibold text-emerald-700">
                  {formatDistance(n.distanceKm)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && near.length === 0 && (
        <p className="mt-2 text-xs text-stone-400">
          {commonTypeById(type.id) ? "Sin resultados en el radio de búsqueda." : ""}
        </p>
      )}
    </section>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
      <p className="text-sm font-medium text-amber-800">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 border-amber-300">
        <RotateCcw className="h-4 w-4" aria-hidden /> Reintentar
      </Button>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
      <p className="text-sm font-bold text-stone-700">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-500">{text}</p>
    </div>
  );
}
