"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Splash } from "./splash";
import { BottomNav, type AppView } from "./bottom-nav";
import { MapView, type MapFilter } from "./map-view";
import { PlacesList } from "./places-list";
import { AddPlaceForm } from "./add-place-form";
import { AboutPanel } from "./about-panel";
import { PlaceDetailSheet } from "./place-detail-sheet";
import { fetchNearbyPlaces } from "@/lib/nearby-client";
import { useToast } from "@/hooks/use-toast";
import { categoryLabel } from "@/lib/geo";
import type {
  Coordinates,
  NearbyPlaceDTO,
  PlaceDetail,
  SingularPlaceDTO,
} from "@/lib/place-types";
import type { MapFocus } from "./map-canvas";

const ONBOARD_KEY = "rutaviva:onboarded";

// Punto de respaldo: Zócalo, CDMX
const DEMO_POINT: Coordinates = { lat: 19.4326, lng: -99.1332 };

function haversine(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function clearNearbyClientCache() {
  const g = globalThis as unknown as { __rvNearbyCache?: Map<string, unknown> };
  g.__rvNearbyCache?.clear();
}

export function RutavivaApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ---- Estado de UI ----
  const [view, setView] = useState<"splash" | AppView>("splash");
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originSource, setOriginSource] = useState<"gps" | "demo" | null>(null);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<MapFilter>("singulares");

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

  const nearbyQuery = useQuery({
    queryKey: ["nearby", filter, origin?.lat ?? null, origin?.lng ?? null],
    queryFn: () => fetchNearbyPlaces(origin as Coordinates, filter),
    enabled: filter !== "singulares" && origin !== null,
    retry: 1,
  });

  const places = placesQuery.data ?? [];
  const nearby = nearbyQuery.data ?? [];

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
            description: "Usamos la ubicación demo (Centro de CDMX).",
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
                "Permiso denegado o no disponible. Activamos la ubicación demo (CDMX); puedes reintentar cuando quieras.",
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

  // ---- Alta de lugar singular ----
  const handleCreated = useCallback(
    (place: SingularPlaceDTO) => {
      toast({
        title: "¡Lugar publicado!",
        description: `${place.name} ya aparece en el mapa para todos.`,
      });
      const dto: SingularPlaceDTO = {
        ...place,
        categoryLabel: categoryLabel(place.category),
        distanceKm: origin ? haversine(origin, { lat: place.lat, lng: place.lng }) : null,
      };
      // Mostrar de inmediato y refrescar en segundo plano
      queryClient.setQueryData<SingularPlaceDTO[]>(
        ["places", origin?.lat ?? null, origin?.lng ?? null],
        (prev) => (prev ? [dto, ...prev] : [dto])
      );
      queryClient.invalidateQueries({ queryKey: ["places"] });
      flyTo({ lat: place.lat, lng: place.lng }, 16);
    },
    [toast, queryClient, flyTo, origin]
  );

  const handleRetryNearby = useCallback(() => {
    clearNearbyClientCache();
    void nearbyQuery.refetch();
  }, [nearbyQuery]);

  const placesError =
    placesQuery.error instanceof Error ? placesQuery.error.message : null;
  const nearbyError =
    nearbyQuery.error instanceof Error
      ? nearbyQuery.error.message
      : nearbyQuery.isError
        ? "No pudimos consultar los servicios cercanos."
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
                nearby={nearby}
                nearbyLoading={nearbyQuery.isPending || nearbyQuery.isRefetching}
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
                  nearby={nearby}
                  nearbyLoading={nearbyQuery.isPending || nearbyQuery.isRefetching}
                  nearbyError={nearbyError}
                  onFlyTo={flyTo}
                  onSelect={openDetail}
                  onRetryPlaces={() => void placesQuery.refetch()}
                  onRetryNearby={handleRetryNearby}
                />
              </div>
            )}
            {view === "add" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto bg-gradient-to-b from-emerald-50/60 to-background">
                <AddPlaceForm origin={origin} onCreated={handleCreated} />
              </div>
            )}
            {view === "about" && (
              <div className="rv-scroll absolute inset-0 overflow-y-auto">
                <AboutPanel places={places} onShowSplash={handleShowSplash} />
              </div>
            )}
          </main>
          <BottomNav view={view === "splash" ? "map" : view} onChange={(v) => setView(v)} />
        </>
      )}

      <PlaceDetailSheet detail={detail} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
