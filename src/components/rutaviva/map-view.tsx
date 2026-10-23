"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { Loader2, MapPin, Plus, RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { COMMON_TYPES, commonTypeById, formatDistance } from "@/lib/geo";
import type {
  Coordinates,
  NearbyPlaceDTO,
  PlaceDetail,
  SingularPlaceDTO,
} from "@/lib/place-types";
import type { MapFocus } from "./map-canvas";

/** Leaflet solo en el navegador (evita errores de SSR). */
const MapCanvas = dynamic(() => import("./map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-emerald-50/60">
      <div className="flex flex-col items-center gap-2 text-emerald-700">
        <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
        <p className="text-sm font-medium">Cargando mapa…</p>
      </div>
    </div>
  ),
});

export type MapFilter = "singulares" | (typeof COMMON_TYPES)[number]["id"];

type MapViewProps = {
  origin: Coordinates | null;
  originSource: "gps" | "demo" | null;
  places: SingularPlaceDTO[];
  nearby: NearbyPlaceDTO[];
  nearbyLoading: boolean;
  nearbyError: string | null;
  filter: MapFilter;
  focus: MapFocus | null;
  onFilterChange: (f: MapFilter) => void;
  onSelect: (d: PlaceDetail) => void;
  onGoAdd: () => void;
  onRequestGps: () => void;
  onRetryNearby: () => void;
};

export function MapView({
  origin,
  originSource,
  places,
  nearby,
  nearbyLoading,
  nearbyError,
  filter,
  focus,
  onFilterChange,
  onSelect,
  onGoAdd,
  onRequestGps,
  onRetryNearby,
}: MapViewProps) {
  const showSingulars = filter === "singulares";
  const typeDef = showSingulars ? undefined : commonTypeById(filter);

  const stripSingulars = [...places]
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, 10);

  return (
    <div className="absolute inset-0">
      <MapCanvas
        origin={origin}
        singularPlaces={places}
        nearbyPlaces={nearby}
        filter={filter}
        focus={focus}
        onSelect={onSelect}
      />

      {/* Capa superior: marca, estado de ubicación y filtros */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[850] space-y-2 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-md backdrop-blur">
            <Image src="/icon-1024.png" alt="" width={16} height={16} className="h-4 w-4 rounded" />
            RutaViva
          </span>
          {originSource === "gps" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-lime-300" aria-hidden />
              GPS activo
            </span>
          ) : originSource === "demo" ? (
            <button
              type="button"
              onClick={onRequestGps}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-emerald-950 shadow-md transition hover:bg-amber-300"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Ubicación demo · usar mi GPS
            </button>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="Filtrar lugares en el mapa"
          className="rv-scroll pointer-events-auto flex gap-2 overflow-x-auto pb-1"
        >
          <FilterChip
            active={showSingulars}
            onClick={() => onFilterChange("singulares")}
            label="Singulares"
            icon={<Star className="h-3.5 w-3.5" aria-hidden />}
            color="#f59e0b"
          />
          {COMMON_TYPES.map((t) => (
            <FilterChip
              key={t.id}
              active={filter === t.id}
              onClick={() => onFilterChange(t.id)}
              label={t.label}
              color={t.color}
            />
          ))}
        </div>
      </div>

      {/* Botón: agregar lugar singular */}
      <Button
        onClick={onGoAdd}
        size="lg"
        aria-label="Agregar lugar singular"
        className="absolute bottom-[9.5rem] right-3 z-[900] h-12 gap-1.5 rounded-2xl bg-emerald-700 px-4 font-bold text-white shadow-xl shadow-emerald-900/30 transition hover:bg-emerald-800 active:scale-95"
      >
        <Plus className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">Agregar</span>
      </Button>

      {/* Franja inferior: resultados según filtro */}
      <div className="absolute inset-x-0 bottom-0 z-[880] p-3">
        {showSingulars ? (
          <div className="rv-scroll flex gap-3 overflow-x-auto pb-1">
            {stripSingulars.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onSelect({
                    kind: "singular",
                    id: p.id,
                    name: p.name,
                    lat: p.lat,
                    lng: p.lng,
                    distanceKm: p.distanceKm,
                    categoryLabel: p.categoryLabel,
                    description: p.description,
                    address: p.address,
                    tips: p.tips,
                    imageUrl: p.imageUrl,
                  })
                }
                className="w-60 shrink-0 rounded-2xl border border-emerald-900/10 bg-white/97 p-3 text-left shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-bold text-stone-800">{p.name}</p>
                  {p.featured && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-label="Destacado" />}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">
                  {p.description}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    {p.categoryLabel}
                  </Badge>
                  {p.distanceKm != null && (
                    <span className="text-xs font-semibold text-emerald-700">
                      a {formatDistance(p.distanceKm)}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {stripSingulars.length === 0 && !origin && (
              <div className="w-full rounded-2xl bg-white/95 p-4 text-center text-sm text-stone-500 shadow-lg">
                Esperando tu ubicación…
              </div>
            )}
          </div>
        ) : (
          <NearbyStrip
            loading={nearbyLoading}
            error={nearbyError}
            nearby={nearby}
            color={typeDef?.color ?? "#57534e"}
            label={typeDef?.label ?? ""}
            onSelect={onSelect}
            onRetry={onRetryNearby}
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  color,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-md transition " +
        (active
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-emerald-900/10 bg-white/95 text-stone-600 hover:bg-white")
      }
    >
      {icon ? (
        <span style={{ color: active ? "#fde68a" : color }} className="inline-flex">
          {icon}
        </span>
      ) : (
        <span
          className="h-2.5 w-2.5 rounded-full border border-white shadow-sm"
          style={{ background: color }}
          aria-hidden
        />
      )}
      {label}
    </button>
  );
}

function NearbyStrip({
  loading,
  error,
  nearby,
  color,
  label,
  onSelect,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  nearby: NearbyPlaceDTO[];
  color: string;
  label: string;
  onSelect: (d: PlaceDetail) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="rv-scroll flex gap-3 overflow-x-auto pb-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[104px] w-60 shrink-0 animate-pulse rounded-2xl bg-white/80" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-2xl bg-white/97 p-4 text-center shadow-lg">
        <p className="text-sm font-medium text-stone-700">{error}</p>
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
          <RotateCcw className="h-4 w-4" aria-hidden /> Reintentar
        </Button>
      </div>
    );
  }
  return (
    <div className="rv-scroll flex gap-3 overflow-x-auto pb-1">
      {nearby.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() =>
            onSelect({
              kind: "common",
              id: n.id,
              name: n.name,
              lat: n.lat,
              lng: n.lng,
              distanceKm: n.distanceKm,
              categoryLabel: label,
              color,
            })
          }
          className="w-52 shrink-0 rounded-2xl border border-emerald-900/10 bg-white/97 p-3 text-left shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-white shadow"
              style={{ background: color }}
              aria-hidden
            />
            <p className="line-clamp-1 text-sm font-bold text-stone-800">{n.name}</p>
          </div>
          <p className="mt-1 text-xs text-stone-500">{label}</p>
          <p className="mt-2 text-xs font-semibold text-emerald-700">
            a {formatDistance(n.distanceKm)}
          </p>
        </button>
      ))}
      {nearby.length === 0 && (
        <div className="w-full rounded-2xl bg-white/95 p-4 text-center text-sm text-stone-500 shadow-lg">
          No encontramos {label.toLowerCase()} muy cerca. Prueba acercando el mapa o con otro filtro.
        </div>
      )}
    </div>
  );
}
