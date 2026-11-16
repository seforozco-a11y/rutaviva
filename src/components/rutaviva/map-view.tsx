"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import { AlertTriangle, Loader2, LocateFixed, MapPin, MessageCirclePlus, Settings, X } from "lucide-react";
import { ensureLocationPermission, isNativeApp, openAppSettings, openLocationSettings } from "./gps";
import { ReportDialog } from "./report-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SINGULAR_CATEGORIES, formatDistance, type SingularCategoryId } from "@/lib/geo";
import { categoryVisual } from "@/lib/category-visual";
import { CategoryIcon } from "./category-icon";
import type {
  Coordinates,
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

/**
 * Filtro del mapa de inicio: una categoría de lugar singular concreta
 * (playa, mirador, monumento…) o null para mostrar TODAS las categorías.
 * Los servicios de OpenStreetMap (farmacias, gasolineras…) ya no se
 * muestran en el mapa; viven solo en la pestaña Servicios de la lista.
 */
export type MapFilter = SingularCategoryId | null;

/** Por qué la app está en modo demo en vez de GPS real. */
export type GpsProblem = "denied" | "off" | "timeout";

/* ==================== Apertura de tarjetas: tap y gesto ==================== */

function openSingular(p: SingularPlaceDTO, onSelect: (d: PlaceDetail) => void) {
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
}

/** Marca de tiempo del último despliegue por gesto; evita un "click fantasma" tras el arrastre. */
let lastSwipeOpenAt = 0;

function swipeJustOpened() {
  return Date.now() - lastSwipeOpenAt < 700;
}

/**
 * Gesto "dedo hacia arriba" sobre una tarjeta emergente: si el arrastre es
 * predominantemente vertical hacia arriba (>=48px), despliega la hoja de
 * detalle. El tap normal sigue funcionando y el scroll horizontal de la
 * franja no se ve afectado (con touch-action pan-x el gesto vertical no
 * compite con el carrusel).
 */
function swipeUpHandlers(onOpen: () => void) {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = startY - t.clientY; // positivo = arrastre hacia arriba
      const dx = Math.abs(startX - t.clientX);
      if (dy > 48 && dy > dx * 1.3) {
        lastSwipeOpenAt = Date.now();
        onOpen();
      }
    },
    onTouchCancel: () => {
      tracking = false;
    },
  };
}

type MapViewProps = {
  origin: Coordinates | null;
  originSource: "gps" | "demo" | null;
  places: SingularPlaceDTO[];
  filter: MapFilter;
  focus: MapFocus | null;
  onFilterChange: (f: MapFilter) => void;
  onSelect: (d: PlaceDetail) => void;
  onRequestGps: () => void;
  /** true mientras se intenta obtener la posición real. */
  locating: boolean;
  /** Último fallo de GPS (null si no hay problema o el usuario eligió demo). */
  gpsProblem: GpsProblem | null;
};

export function MapView({
  origin,
  originSource,
  places,
  filter,
  focus,
  onFilterChange,
  onSelect,
  onRequestGps,
  locating,
  gpsProblem,
}: MapViewProps) {
  // Canal "Ayuda y comentarios" (reportes de funcionamiento/contenido) —
  // accesible siempre desde la barra superior del mapa.
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // El aviso se puede cerrar, pero reaparece ante cada fallo: como se
  // desmonta cuando gpsProblem vuelve a null (cada reintento pasa por ahí),
  // su estado interno se destruye y se remonta abierto.

  // Franja inferior: lugares singulares visibles según la categoría elegida
  // (null = todas), ordenados por cercanía, máximo 10 tarjetas.
  const visiblePlaces = filter
    ? places.filter((p) => p.category === filter)
    : places;
  const stripSingulars = [...visiblePlaces]
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, 10);
  const activeLabel = filter
    ? (SINGULAR_CATEGORIES.find((c) => c.id === filter)?.label ?? "")
    : "";

  return (
    <div className="absolute inset-0">
      <MapCanvas
        origin={origin}
        singularPlaces={places}
        categoryFilter={filter}
        focus={focus}
        onSelect={onSelect}
      />

      {/* Capa superior: marca, estado de ubicación y filtros. El pr-16 evita
          que el contenido toque la columna de controles de zoom/centrado del
          mapa (esquina derecha), que tapa la X del aviso. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[850] space-y-2 p-3 pr-16">
        {originSource === "demo" && gpsProblem && (
          <GpsProblemBanner problem={gpsProblem} onRetry={onRequestGps} />
        )}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-md backdrop-blur">
            <Image src="/icon-1024.png" alt="" width={16} height={16} className="h-4 w-4 rounded" />
            RutaViva
          </span>
          {locating ? (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-md backdrop-blur"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Buscando tu ubicación…
            </span>
          ) : originSource === "gps" ? (
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
              {gpsProblem === "denied"
                ? "GPS sin permiso · activar"
                : gpsProblem === "off"
                  ? "GPS apagado · activar"
                  : gpsProblem === "timeout"
                    ? "GPS lento · reintentar"
                    : "Ubicación demo · usar mi GPS"}
            </button>
          ) : null}

          {/* Canal de comentarios de la app: siempre visible, discreto. */}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            aria-label="Enviar ayuda o comentarios sobre la app"
            className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-emerald-900/10 bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-md backdrop-blur transition hover:text-emerald-800"
          >
            <MessageCirclePlus className="h-3.5 w-3.5" aria-hidden />
            Ayuda y comentarios
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Filtros del mapa: cerca de mí o por categoría"
          className="rv-scroll pointer-events-auto flex gap-2 overflow-x-auto pb-1"
        >
          {/* «Cerca de mí»: el estado base del mapa. Siempre primer chip y
              activo al abrir; un toque regresa a la lista de lugares más
              cercanos según el GPS, desde cualquier categoría. */}
          <FilterChip
            active={filter === null}
            onClick={() => onFilterChange(null)}
            label="Cerca de mí"
            icon={<LocateFixed className="h-3.5 w-3.5" />}
          />
          {SINGULAR_CATEGORIES.map((c) => (
            <FilterChip
              key={c.id}
              active={filter === c.id}
              onClick={() => onFilterChange(filter === c.id ? null : c.id)}
              label={c.label}
              icon={<CategoryIcon category={c.id} className="h-3.5 w-3.5" />}
            />
          ))}
        </div>
      </div>

      {/* Franja inferior: lugares singulares según la categoría elegida.
          El padding inferior despeja la barra de navegación fija (h-16 +
          safe-area) para que las tarjetas y avisos NUNCA queden tapados. */}
      <div className="absolute inset-x-0 bottom-0 z-[880] p-3 pb-[calc(env(safe-area-inset-bottom)+78px)]">
        <div className="rv-scroll flex gap-3 overflow-x-auto pb-1 [touch-action:pan-x]">
          {stripSingulars.map((p) => {
            const cat = categoryVisual(p.category);
            return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (swipeJustOpened()) return;
                openSingular(p, onSelect);
              }}
              {...swipeUpHandlers(() => openSingular(p, onSelect))}
              className="w-60 shrink-0 rounded-2xl border border-emerald-900/10 bg-white/97 p-3 text-left shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-1 text-sm font-bold text-stone-800">{p.name}</p>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: cat.bg, color: cat.fg }}
                  role="img"
                  aria-label={`Categoría: ${p.categoryLabel}`}
                >
                  <CategoryIcon category={p.category} className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">
                {p.description}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge
                  className="gap-1 border-0 hover:opacity-90"
                  style={{ background: cat.bg, color: cat.fg }}
                >
                  <CategoryIcon category={p.category} className="h-3 w-3" />
                  {p.categoryLabel}
                </Badge>
                {p.distanceKm != null && (
                  <span className="text-xs font-semibold text-emerald-700">
                    a {formatDistance(p.distanceKm)}
                  </span>
                )}
              </div>
            </button>
            );
          })}
          {stripSingulars.length === 0 && !origin && (
            <div className="w-full rounded-2xl bg-white/95 p-4 text-center text-sm text-stone-500 shadow-lg">
              Esperando tu ubicación…
            </div>
          )}
          {stripSingulars.length === 0 && origin && (
            <div className="w-full rounded-2xl bg-white/95 p-4 text-center text-sm text-stone-500 shadow-lg">
              {filter
                ? `Aún no hay lugares «${activeLabel}» en el mapa. Toca «Cerca de mí» para volver a ver lo que hay cerca.`
                : "Aún no hay lugares singulares publicados cerca. Prueba acercando el mapa."}
            </div>
          )}
        </div>
      </div>
      {feedbackOpen && <ReportDialog kind="APP" onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}

/**
 * Chip de categoría del mapa, siempre en verde: sólido cuando está activo,
 * verde claro cuando no, con el icono de la categoría. Segundo toque sobre
 * el activo lo deselecciona (lo maneja el onClick del padre).
 */
function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
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
          ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-600"
          : "border-emerald-700/25 bg-emerald-50/95 text-emerald-900 hover:bg-emerald-100/90")
      }
    >
      <span
        style={{ color: active ? "#ffffff" : "#047857" }}
        className="inline-flex"
        aria-hidden
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ==================== Aviso de GPS con recuperación ==================== */

const GPS_BANNER_COPY: Record<GpsProblem, { title: string; text: string; cta: string }> = {
  denied: {
    title: "Tu GPS no tiene permiso",
    text: "Toca «Activar GPS». Si la ventana de permiso ya no aparece, te llevamos directo a Ajustes → RutaViva → Permisos.",
    cta: "Activar GPS",
  },
  off: {
    title: "GPS apagado o sin señal",
    text: "Activa la Ubicación de tu teléfono y reintenta. Puedes seguir explorando en modo demo.",
    cta: "Reintentar",
  },
  timeout: {
    title: "El GPS tardó demasiado",
    text: "Suele pasar en interiores. Sal a un lugar abierto y reintenta.",
    cta: "Reintentar",
  },
};

/**
 * Aviso persistente (se puede cerrar, reaparece ante cada fallo) que explica
 * por qué la app está en modo demo y ofrece acciones directas: activar el
 * permiso, abrir Ajustes o reintentar. Clave para que el usuario NUNCA sienta
 * que "la navegación falló en silencio".
 */
function GpsProblemBanner({
  problem,
  onRetry,
}: {
  problem: GpsProblem;
  onRetry: () => void;
}) {
  const copy = GPS_BANNER_COPY[problem];
  // El usuario puede cerrarlo; reaparece solo ante el siguiente fallo
  // (el banner se desmonta cuando gpsProblem pasa a null y se remonta).
  const [closed, setClosed] = useState(false);
  // Solo se renderiza del lado del cliente (gpsProblem llega tras un fallo),
  // así que leer el puente nativo aquí no causa mismatch de hidratación.
  const native = isNativeApp();
  const [working, setWorking] = useState(false);

  if (closed) return null;

  // denied → pedir el permiso de nuevo (diálogo nativo) y, si el sistema ya
  // no lo muestra, abrir Ajustes automáticamente; luego reintentar si cedió.
  const handleCta = () => {
    if (problem !== "denied") {
      onRetry();
      return;
    }
    setWorking(true);
    void ensureLocationPermission().then((granted) => {
      setWorking(false);
      if (granted) onRetry();
    });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50/97 p-3 shadow-lg"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-amber-900">{copy.title}</p>
        <p className="mt-0.5 text-xs leading-snug text-amber-800/90">{copy.text}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handleCta}
            disabled={working}
            className="min-h-[36px] gap-1.5 bg-amber-500 text-emerald-950 hover:bg-amber-400"
          >
            {working ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <MapPin className="h-3.5 w-3.5" aria-hidden />
            )}
            {copy.cta}
          </Button>
          {native && (problem === "denied" || problem === "off") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void (problem === "denied"
                  ? openAppSettings()
                  : openLocationSettings())
              }
              className="min-h-[36px] gap-1.5 text-amber-900 hover:bg-amber-100 hover:text-amber-950"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              {problem === "denied" ? "Abrir ajustes" : "Abrir ubicación"}
            </Button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Cerrar aviso de ubicación"
        className="-m-1 rounded-full p-1.5 text-amber-700 transition hover:bg-amber-100"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
