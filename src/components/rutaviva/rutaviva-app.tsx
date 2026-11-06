"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Splash } from "./splash";
import { BottomNav, type AppView } from "./bottom-nav";
import { MapView, type GpsProblem, type MapFilter } from "./map-view";
import { locate } from "./gps";
import { PlacesList } from "./places-list";
import { AddPlaceForm } from "./add-place-form";
import { PlaceDetailSheet } from "./place-detail-sheet";
import { AboutPanel } from "./about-panel";
import { AdminPanel } from "./admin/admin-panel";
import { fetchNearbyPlaces, clearNearbyCache } from "@/lib/nearby-client";
import { useToast } from "@/hooks/use-toast";
import { COMMON_TYPES } from "@/lib/geo";
import type {
  Coordinates,
  NearbyPlaceDTO,
  PlaceDetail,
  SingularPlaceDTO,
} from "@/lib/place-types";
import type { MapFocus } from "./map-canvas";
import { closeTopBackLayer } from "@/lib/back-layers";

const ONBOARD_KEY = "rutaviva:onboarded";

// Punto de respaldo: Centro Histórico de Manzanillo, Colima
const DEMO_POINT: Coordinates = { lat: 19.0536, lng: -104.3149 };

// ---- Portada en cada apertura (solo APK) ----
// Al abrir la app, la portada PERMANECE hasta que el usuario elige: toca el
// botón amarillo "Explorar cerca de mí" o el modo demo. Mientras tanto, ya se
// pidió el GPS en silencio — así el toque encuentra la posición caliente
// (caché de 30 s del sistema) y los lugares cercanos cargan al instante. Los
// enlaces compartidos (?view=…) siguen entrando directos, sin portada.

// ---- Enlaces directos (?view=add|list|about) ----
// Permiten compartir URLs que abren una vista concreta (p. ej. el guion de
// pruebas manda a los testers directo al formulario de sugerencias, o a la
// guía de la app). El mapa es el default y "admin" se excluye a propósito:
// requiere PIN y no se promueve por enlaces.
const DEEP_VIEWS = new Set<AppView>(["list", "add", "about"]);

function deepViewFromUrl(): AppView | null {
  try {
    const v = new URLSearchParams(window.location.search).get("view");
    return v && DEEP_VIEWS.has(v as AppView) ? (v as AppView) : null;
  } catch {
    return null;
  }
}

export function RutavivaApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Estado de UI ----
  const [view, setView] = useState<"splash" | AppView>("splash");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originSource, setOriginSource] = useState<"gps" | "demo" | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsProblem, setGpsProblem] = useState<GpsProblem | null>(null);
  const [filter, setFilter] = useState<MapFilter>("singulares");
  const [listTab, setListTab] = useState<"singulares" | "servicios">("singulares");

  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusK = useRef(0);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Vista destino de un enlace directo (?view=add|list), leída una vez en el
  // arranque y consumida al pasar la portada (o al saltarla si ya vio la intro).
  const deepViewRef = useRef<AppView | null>(null);

  // ---- Estado del servidor (TanStack Query) ----
  const placesQuery = useQuery({
    queryKey: ["places", origin?.lat ?? null, origin?.lng ?? null],
    queryFn: async (): Promise<SingularPlaceDTO[]> => {
      const qs = origin ? `?lat=${origin.lat}&lng=${origin.lng}&radiusKm=120` : "";
      const r = await fetch(`/api/places${qs}`);
      if (!r.ok) throw new Error("No se pudieron cargar los lugares singulares");
      const j = (await r.json()) as { places?: SingularPlaceDTO[] };
      return j.places ?? [];
    },
  });

  // Una query por tipo de servicio: se activa con el filtro del mapa o con la
  // pestaña Servicios de la lista. Nota: en TanStack v5 una query deshabilitada
  // está "pending", por eso usamos isLoading (pending + fetching) para la UI.
  const nearbyQueries = useQueries({
    queries: COMMON_TYPES.map((t) => ({
      queryKey: ["nearby", t.id, origin?.lat ?? null, origin?.lng ?? null],
      queryFn: () => fetchNearbyPlaces(origin as Coordinates, t.id),
      enabled:
        origin !== null &&
        (filter === t.id || (view === "list" && listTab === "servicios")),
      retry: 1,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const nearbyByType = new Map(
    COMMON_TYPES.map((t, i) => [t.id, nearbyQueries[i]])
  );

  const places = placesQuery.data ?? [];

  // Datos para el mapa: solo el tipo seleccionado en el filtro.
  const selectedNearby =
    filter !== "singulares" ? nearbyByType.get(filter) : undefined;
  const nearbyForMap = selectedNearby?.data ?? [];
  const nearbyLoadingForMap = selectedNearby?.isLoading ?? false;

  // Datos para la lista: todos los tipos juntos.
  const allNearbyResults = COMMON_TYPES.map((t) => nearbyByType.get(t.id));
  const nearbyForList = allNearbyResults.flatMap((r) => r?.data ?? []);
  const nearbyLoadingForList = allNearbyResults.some(
    (r) => r?.isLoading ?? false
  );
  const nearbyAllFailed =
    allNearbyResults.length > 0 && allNearbyResults.every((r) => r?.isError);

  /** Centra el mapa en un punto (con vista de mapa activa). */
  const focusOn = useCallback((c: Coordinates, zoom = 15) => {
    focusK.current += 1;
    setFocus({ lat: c.lat, lng: c.lng, zoom, k: focusK.current });
  }, []);

  /** Vuela a un punto y cambia a la vista de mapa (acciones desde la lista). */
  const flyTo = useCallback(
    (c: Coordinates, zoom = 16) => {
      focusOn(c, zoom);
      setView("map");
    },
    [focusOn]
  );

  const openDetail = useCallback((d: PlaceDetail) => {
    setDetail(d);
    setSheetOpen(true);
  }, []);

  // ---- Botón atrás de Android (solo dentro de la APK con puente nativo) ----
  // Jerarquía: cierra la hoja de detalle → regresa al menú anterior →
  // desde el menú principal (mapa) sale de la app (comportamiento estándar).
  const viewRef = useRef(view);
  const sheetOpenRef = useRef(sheetOpen);
  const viewHistoryRef = useRef<Array<"splash" | AppView>>([]);

  useEffect(() => {
    if (viewRef.current !== view) {
      viewHistoryRef.current.push(viewRef.current);
      if (viewHistoryRef.current.length > 24) viewHistoryRef.current.shift();
      viewRef.current = view;
    }
  }, [view]);

  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
  }, [sheetOpen]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return; // en navegador/PWA no interviene
    let disposed = false;
    let removeListener: (() => void) | undefined;

    void CapApp.addListener("backButton", () => {
      // 0) Capa apilada abierta (tarjeta de foto, pantalla completa, aviso de
      //    privacidad…) → cerrar SOLO esa capa, como en la web (Task 25/26/27)
      if (closeTopBackLayer()) {
        return;
      }
      // 1) Hoja de detalle abierta → solo cerrarla
      if (sheetOpenRef.current) {
        setSheetOpen(false);
        return;
      }
      const current = viewRef.current;
      // 2) Menú principal o portada → salir de la app
      if (current === "splash" || current === "map") {
        void CapApp.exitApp();
        return;
      }
      // 3) Vista secundaria → regresar a la anterior; si no hay, al mapa
      let prev = viewHistoryRef.current.pop();
      while (prev === current) prev = viewHistoryRef.current.pop();
      setView(prev && prev !== "splash" ? prev : "map");
    }).then((handle) => {
      if (disposed) handle.remove();
      else removeListener = () => handle.remove();
    });

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, []);

  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* noop */
    }
  }, []);

  // ---- Geolocalización ----
  // Usa el puente nativo (src/components/rutaviva/gps.ts): el diálogo de
  // permiso de Android reaparece en CADA apertura mientras esté pendiente y
  // el aviso del mapa siempre explica el problema con acciones concretas.
  // Evita intentos simultáneos (doble tap) y clasifica el fallo para que la
  // UI siempre explique qué pasó y cómo recuperarse.
  const gpsBusy = useRef(false);
  const requestGps = useCallback(
    (opts?: { silent?: boolean }) => {
      if (gpsBusy.current) return;
      gpsBusy.current = true;
      setGpsProblem(null);
      setLocating(true);
      void locate().then((r) => {
        gpsBusy.current = false;
        setLocating(false);
        if (r.ok) {
          const c: Coordinates = { lat: r.lat, lng: r.lng };
          setOrigin(c);
          setOriginSource("gps");
          setGpsProblem(null);
          focusOn(c, 15);
          if (!opts?.silent) {
            toast({ title: "Ubicación lista", description: "Explorando lugares cerca de ti." });
          }
          return;
        }
        // Fallback: modo demo (la app sigue usable) + aviso SIEMPRE, incluso
        // en el arranque silencioso — el usuario nunca siente que la app
        // "falló en silencio" al abrirla.
        setOrigin(DEMO_POINT);
        setOriginSource("demo");
        setGpsProblem(r.problem);
        focusOn(DEMO_POINT, 14);
        const copy =
          r.problem === "denied"
            ? {
                title: "No autorizaste tu ubicación",
                description:
                  "Toca «GPS sin permiso · activar» arriba del mapa, o ve a Ajustes → Aplicaciones → RutaViva → Permisos.",
              }
            : r.problem === "off"
              ? {
                  title: "GPS apagado o sin señal",
                  description:
                    "Activa la Ubicación de tu teléfono y toca «Reintentar». Modo demo activo mientras tanto.",
                }
              : {
                  title: "El GPS tardó demasiado",
                  description:
                    "Suele pasar en interiores. Toca «Reintentar» en el aviso del mapa.",
                };
        if (opts?.silent) {
          // Arranque automático: aviso informativo (no alarmista) + banner fijo.
          toast(copy);
        } else {
          toast({ variant: "destructive", ...copy });
        }
      });
    },
    [toast, focusOn]
  );

  // Referencia siempre fresca de requestGps para el efecto de arranque (sin
  // re-ejecutarlo cuando cambian sus dependencias internas).
  const requestGpsRef = useRef(requestGps);
  useEffect(() => {
    requestGpsRef.current = requestGps;
  }, [requestGps]);

  // ---- Arranque: saltar portada si ya vio la intro (evita mismatch de hidratación) ----
  useEffect(() => {
    const t = setTimeout(() => {
      // Enlace directo (?view=add|list): se consume UNA vez y se limpia de la
      // URL para que recargas o capturas no hereden el salto de vista.
      deepViewRef.current = deepViewFromUrl();
      if (deepViewRef.current) {
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete("view");
          window.history.replaceState(null, "", u);
        } catch {
          /* historial no disponible */
        }
      }
      try {
        if (localStorage.getItem(ONBOARD_KEY) === "1") {
          const dv = deepViewRef.current;
          deepViewRef.current = null; // el enlace se consume UNA vez
          if (Capacitor.isNativePlatform()) {
            // App Android: pedir GPS en CADA apertura. Si el permiso está
            // pendiente, el sistema vuelve a mostrar su diálogo; si ya está
            // concedido, ubica sin preguntar; si fue negado, cae en demo con
            // aviso visible (la app nunca se ve "muerta").
            requestGpsRef.current({ silent: true });
            if (dv) {
              // Enlace compartido (?view=…): directo a su vista, sin portada.
              setView(dv);
            }
            // Sin enlace: la portada PERMANECE hasta que el usuario elija
            // (botón amarillo "Explorar cerca de mí" o modo demo). El GPS ya
            // corre en silencio de fondo, así que el toque entra con la
            // posición caliente y los lugares cargando de una vez.
          } else {
            // Navegador/PWA: demo por defecto (el usuario decide con el botón).
            setOrigin(DEMO_POINT);
            setOriginSource("demo");
            setView(dv ?? "map");
          }
        }
      } catch {
        /* localStorage no disponible */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Tras la portada, un enlace directo (?view=…) manda a esa vista; si no
  // hay, se aterriza en el mapa como siempre.
  const handleExplore = useCallback(() => {
    finishOnboarding();
    const dv = deepViewRef.current;
    deepViewRef.current = null; // consumido: recargas de portada ya no repiten el salto
    setView(dv ?? "map");
    requestGps();
  }, [requestGps, finishOnboarding]);

  const handleDemo = useCallback(() => {
    setOrigin(DEMO_POINT);
    setOriginSource("demo");
    setGpsProblem(null);
    finishOnboarding();
    const dv = deepViewRef.current;
    deepViewRef.current = null; // consumido: una sola vez también en modo demo
    setView(dv ?? "map");
    focusOn(DEMO_POINT, 14);
  }, [finishOnboarding, focusOn]);

  // ---- Sugerencia de lugar (entra PENDING a la cola del admin) ----
  const handleSuggested = useCallback(() => {
    toast({
      title: "¡Sugerencia enviada a revisión!",
      description:
        "El equipo RutaViva la validará antes de publicarla. ¡Gracias por sumar!",
    });
  }, [toast]);

  const handleSuggestionDone = useCallback(() => setView("map"), []);

  const handleRetryNearby = useCallback(() => {
    clearNearbyCache();
    queryClient.invalidateQueries({ queryKey: ["nearby"] });
  }, [queryClient]);

  const placesError =
    placesQuery.error instanceof Error ? placesQuery.error.message : null;
  const nearbyError = selectedNearby?.error instanceof Error
    ? selectedNearby.error.message
    : selectedNearby?.isError
      ? "No pudimos consultar los servicios cercanos."
      : null;
  const nearbyListError = nearbyAllFailed
    ? "No pudimos consultar los servicios cercanos. Revisa tu conexión e intenta de nuevo."
    : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {view === "splash" ? (
        <Splash onExplore={handleExplore} onDemo={handleDemo} locating={locating} />
      ) : (
        <>
          <main className="relative min-h-0 flex-1">
            {view === "map" && (
              <MapView
                origin={origin}
                originSource={originSource}
                locating={locating}
                gpsProblem={gpsProblem}
                places={places}
                nearby={nearbyForMap}
                nearbyLoading={nearbyLoadingForMap}
                nearbyError={nearbyError}
                filter={filter}
                focus={focus}
                onFilterChange={setFilter}
                onSelect={openDetail}
                onRequestGps={() => requestGps()}
                onRetryNearby={handleRetryNearby}
              />
            )}
            {view === "list" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto">
                <PlacesList
                  origin={origin}
                  places={places}
                  placesLoading={placesQuery.isPending}
                  placesError={placesError}
                  nearby={nearbyForList}
                  nearbyLoading={nearbyLoadingForList}
                  nearbyError={nearbyListError}
                  tab={listTab}
                  onTabChange={setListTab}
                  onFlyTo={flyTo}
                  onSelect={openDetail}
                  onRetryPlaces={() => void placesQuery.refetch()}
                  onRetryNearby={handleRetryNearby}
                />
              </div>
            )}
            {view === "add" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto bg-gradient-to-b from-emerald-50/60 to-background">
                <AddPlaceForm
                  origin={origin}
                  onSuggested={handleSuggested}
                  onDone={handleSuggestionDone}
                />
              </div>
            )}
            {view === "about" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto bg-gradient-to-b from-emerald-50/60 to-background">
                <AboutPanel
                  places={places}
                  onShowSplash={() => setView("splash")}
                />
              </div>
            )}
            {view === "admin" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto bg-gradient-to-b from-stone-50 to-background">
                <AdminPanel origin={origin} />
              </div>
            )}
          </main>
          <BottomNav view={view} onChange={(v) => setView(v)} />
        </>
      )}

      <PlaceDetailSheet detail={detail} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
