"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Splash } from "./splash";
import { BottomNav, type AppView } from "./bottom-nav";
import { MapView, type MapFilter } from "./map-view";
import { PlacesList } from "./places-list";
import { AddPlaceForm } from "./add-place-form";
import { AboutPanel } from "./about-panel";
import { PlaceDetailSheet } from "./place-detail-sheet";
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

const ONBOARD_KEY = "rutaviva:onboarded";

// Punto de respaldo: Centro Histórico de Manzanillo, Colima
const DEMO_POINT: Coordinates = { lat: 19.0536, lng: -104.3149 };

export function RutavivaApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Estado de UI ----
  const [view, setView] = useState<"splash" | AppView>("splash");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originSource, setOriginSource] = useState<"gps" | "demo" | null>(null);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<MapFilter>("singulares");
  const [listTab, setListTab] = useState<"singulares" | "servicios">("singulares");

  const [focus, setFocus] = useState<MapFocus | null>(null);
  const focusK = useRef(0);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // ---- Arranque: saltar portada si ya vio la intro (evita mismatch de hidratación) ----
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(ONBOARD_KEY) === "1") {
          setView("map");
          setOrigin(DEMO_POINT);
          setOriginSource("demo");
        }
      } catch {
        /* localStorage no disponible */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* noop */
    }
  }, []);

  // ---- Geolocalización ----
  const requestGps = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!("geolocation" in navigator)) {
        if (!opts?.silent) {
          toast({
            title: "GPS no disponible",
            description: "Usamos la ubicación demo (Centro de Manzanillo).",
          });
        }
        setOrigin(DEMO_POINT);
        setOriginSource("demo");
        focusOn(DEMO_POINT, 14);
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setOrigin(c);
          setOriginSource("gps");
          setLocating(false);
          focusOn(c, 15);
          if (!opts?.silent) {
            toast({ title: "Ubicación lista", description: "Explorando lugares cerca de ti." });
          }
        },
        () => {
          setLocating(false);
          setOrigin(DEMO_POINT);
          setOriginSource("demo");
          focusOn(DEMO_POINT, 14);
          if (!opts?.silent) {
            toast({
              variant: "destructive",
              title: "No pudimos usar tu GPS",
              description:
                "Permiso denegado o no disponible. Activamos la ubicación demo (Manzanillo); puedes reintentar cuando quieras.",
            });
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    },
    [toast, focusOn]
  );

  const handleExplore = useCallback(() => {
    finishOnboarding();
    setView("map");
    requestGps();
  }, [requestGps, finishOnboarding]);

  const handleDemo = useCallback(() => {
    setOrigin(DEMO_POINT);
    setOriginSource("demo");
    finishOnboarding();
    setView("map");
    focusOn(DEMO_POINT, 14);
  }, [finishOnboarding, focusOn]);

  const handleShowSplash = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARD_KEY);
    } catch {
      /* noop */
    }
    setView("splash");
  }, []);

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
                places={places}
                nearby={nearbyForMap}
                nearbyLoading={nearbyLoadingForMap}
                nearbyError={nearbyError}
                filter={filter}
                focus={focus}
                onFilterChange={setFilter}
                onSelect={openDetail}
                onGoAdd={() => setView("add")}
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
            {view === "admin" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto bg-gradient-to-b from-stone-50 to-background">
                <AdminPanel origin={origin} />
              </div>
            )}
            {view === "about" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto">
                <AboutPanel places={places} onShowSplash={handleShowSplash} />
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
