/**
 * Cliente de lugares comunes (OpenStreetMap Overpass) para el navegador.
 *
 * ¿Por qué desde el cliente? Overpass API soporta CORS y así el tráfico de
 * mapas no pasa por el servidor (más barato y escalable). Si el navegador no
 * puede llegar a Overpass, se intenta como respaldo la ruta del servidor
 * /api/nearby (proxy) y si tampoco está disponible se lanza un error amable.
 *
 * Incluye caché en memoria de 5 minutos por (tipo, celda de ~200 m).
 */
import { COMMON_TYPES, type Coordinates } from "@/lib/geo";
import type { NearbyPlaceDTO } from "@/lib/place-types";

type CacheEntry = { ts: number; places: NearbyPlaceDTO[] };

const globalCache = globalThis as unknown as {
  __rvNearbyCache?: Map<string, CacheEntry>;
};
const cache: Map<string, CacheEntry> =
  globalCache.__rvNearbyCache ?? new Map<string, CacheEntry>();
globalCache.__rvNearbyCache = cache;

const TTL = 5 * 60 * 1000;

export function clearNearbyCache() {
  cache.clear();
}

function cacheKey(origin: Coordinates, type: string, radius: number) {
  return `${type}:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radius}`;
}

export async function fetchNearbyPlaces(
  origin: Coordinates,
  type: string,
  radius = 1500
): Promise<NearbyPlaceDTO[]> {
  const key = cacheKey(origin, type, radius);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.places;

  try {
    const places = await queryOverpass(origin, type, radius);
    cache.set(key, { ts: Date.now(), places });
    return places;
  } catch {
    // Respaldo: proxy del servidor (útil en producción o si el cliente bloquea la petición)
    const url = `/api/nearby?lat=${origin.lat}&lng=${origin.lng}&type=${type}&radius=${radius}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error ?? "Sin conexión con el mapa de servicios");
    const places = (json.places ?? []) as NearbyPlaceDTO[];
    cache.set(key, { ts: Date.now(), places });
    return places;
  }
}

async function queryOverpass(
  origin: Coordinates,
  type: string,
  radius: number
): Promise<NearbyPlaceDTO[]> {
  const def = COMMON_TYPES.find((t) => t.id === type);
  if (!def) throw new Error("Tipo de lugar no soportado");

  const selectors = def.osm
    .map(
      (s) =>
        `node${s}(around:${radius},${origin.lat},${origin.lng});way${s}(around:${radius},${origin.lat},${origin.lng});`
    )
    .join("\n");
  const query = `[out:json][timeout:20];\n(\n${selectors}\n);\nout center 50;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = (await res.json()) as {
      elements?: Array<{
        type: string;
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const seen = new Set<string>();
    return (json.elements ?? [])
      .map((e) => {
        const lat = e.lat ?? e.center?.lat;
        const lng = e.lon ?? e.center?.lon;
        if (lat == null || lng == null) return null;
        return {
          id: `${e.type}/${e.id}`,
          name: e.tags?.name ?? e.tags?.brand ?? e.tags?.operator ?? "Sin nombre",
          lat,
          lng,
          type,
          distanceKm: haversineKm(origin, { lat, lng }),
        } satisfies NearbyPlaceDTO;
      })
      .filter((p): p is NearbyPlaceDTO => p !== null)
      .filter((p) => {
        const k = `${p.name}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 40);
  } finally {
    clearTimeout(timer);
  }
}

function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
