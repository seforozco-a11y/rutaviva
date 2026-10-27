"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { commonTypeById, categoryLabel } from "@/lib/geo";
import { categorySvg, categoryVisual } from "@/lib/category-visual";
import type {
  Coordinates,
  NearbyPlaceDTO,
  PlaceDetail,
  SingularPlaceDTO,
} from "@/lib/place-types";

export type MapFocus = { lat: number; lng: number; zoom?: number; k: number };

type MapCanvasProps = {
  origin: Coordinates | null;
  singularPlaces: SingularPlaceDTO[];
  nearbyPlaces: NearbyPlaceDTO[];
  filter: string;
  focus: MapFocus | null;
  onSelect: (detail: PlaceDetail) => void;
};

const STAR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="#ffffff" stroke="none" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

/**
 * Pin de lugar singular: color e icono según la categoría (playa, mirador,
 * monumento…). Los destacados llevan una estrella ámbar como insignia.
 */
function singularIcon(categoryId: string, featured: boolean): L.DivIcon {
  const v = categoryVisual(categoryId);
  const badge = featured
    ? `<div class="rv-pin-badge" aria-hidden="true">${STAR_SVG}</div>`
    : "";
  return L.divIcon({
    className: "rv-icon",
    html:
      `<div class="rv-pin" style="background:${v.fg}">` +
      categorySvg(categoryId, { className: "rv-pin-ico", style: "color:#fff" }) +
      `</div>${badge}`,
    iconSize: [30, 30],
    iconAnchor: [15, 27],
  });
}

function commonIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "rv-icon",
    html: `<div class="rv-dot" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const USER_ICON = L.divIcon({
  className: "rv-icon",
  html: '<div class="rv-user-marker" role="img" aria-label="Tu ubicación"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/** Ajusta el tamaño del mapa al montar y al cambiar el contenedor. */
function SizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

/** Vuela hacia un destino cuando cambia `focus`. */
function FocusController({ focus }: { focus: MapFocus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom ?? 16, { duration: 0.9 });
  }, [focus, map]);
  return null;
}

/** Controles propios (+, −, centrar) dentro del contenedor del mapa. */
function MapControls({ origin }: { origin: Coordinates | null }) {
  const map = useMap();
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-900/10 bg-white/95 text-emerald-800 shadow-lg backdrop-blur transition hover:bg-white active:scale-95";
  return (
    <div className="absolute right-3 top-3 z-[900] flex flex-col gap-2">
      <button type="button" aria-label="Acercar" className={btn} onClick={() => map.zoomIn()}>
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      <button type="button" aria-label="Alejar" className={btn} onClick={() => map.zoomOut()}>
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      {origin && (
        <button
          type="button"
          aria-label="Centrar en mi ubicación"
          className={btn}
          onClick={() => map.flyTo(origin, 15, { duration: 0.8 })}
        >
          <LocateFixed className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export function MapCanvas({
  origin,
  singularPlaces,
  nearbyPlaces,
  filter,
  focus,
  onSelect,
}: MapCanvasProps) {
  const center: [number, number] = origin ? [origin.lat, origin.lng] : [19.4326, -99.1332];
  const showSingulars = filter === "singulares";

  return (
    <MapContainer
      center={center}
      zoom={origin ? 14 : 12}
      zoomControl={false}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <SizeInvalidator />
      <FocusController focus={focus} />
      <MapControls origin={origin} />

      {origin && (
        <>
          <Circle
            center={origin}
            radius={90}
            pathOptions={{ color: "#059669", weight: 1, fillOpacity: 0.08 }}
          />
          <Marker position={origin} icon={USER_ICON} zIndexOffset={1000} interactive={false} />
        </>
      )}

      {showSingulars
        ? singularPlaces.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={singularIcon(p.category, p.featured)}
              eventHandlers={{ click: () => toDetail(p, onSelect) }}
            />
          ))
        : nearbyPlaces.map((n) => (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={commonIcon(commonTypeById(n.type)?.color ?? "#57534e")}
              eventHandlers={{ click: () => toNearbyDetail(n, onSelect) }}
            />
          ))}
    </MapContainer>
  );
}

function toDetail(p: SingularPlaceDTO, onSelect: (d: PlaceDetail) => void) {
  onSelect({
    kind: "singular",
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    distanceKm: p.distanceKm,
    category: p.category,
    categoryLabel: p.categoryLabel || categoryLabel(p.category),
    description: p.description,
    address: p.address,
    tips: p.tips,
    imageUrl: p.imageUrl,
  });
}

function toNearbyDetail(n: NearbyPlaceDTO, onSelect: (d: PlaceDetail) => void) {
  onSelect({
    kind: "common",
    id: n.id,
    name: n.name,
    lat: n.lat,
    lng: n.lng,
    distanceKm: n.distanceKm,
    categoryLabel: commonTypeById(n.type)?.label ?? "Servicio",
    color: commonTypeById(n.type)?.color,
  });
}
