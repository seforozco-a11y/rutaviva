/**
 * Utilidades geográficas compartidas (cliente y servidor).
 * Sin dependencias externas: Haversine puro en TypeScript.
 */

export type Coordinates = { lat: number; lng: number };

/** Distancia en kilómetros entre dos coordenadas (Haversine). */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const R = 6371; // radio terrestre km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Formatea distancia para UI: "350 m" / "2.4 km" */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Enlace universal de direcciones de Google Maps (funciona en Android e iOS). */
export function directionsUrl(dest: Coordinates, label?: string): string {
  const q = label ? `${dest.lat},${dest.lng}(${encodeURIComponent(label)})` : `${dest.lat},${dest.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/** Categorías de lugares singulares (extensible desde la base de datos). */
export const SINGULAR_CATEGORIES = [
  { id: "monumento", label: "Monumento" },
  { id: "museo", label: "Museo" },
  { id: "mirador", label: "Mirador" },
  { id: "plaza", label: "Plaza histórica" },
  { id: "parque", label: "Parque" },
  { id: "gastronomia", label: "Gastronomía" },
  { id: "naturaleza", label: "Naturaleza" },
  { id: "cultura", label: "Cultura" },
  { id: "otro", label: "Otro" },
] as const;

export type SingularCategoryId = (typeof SINGULAR_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return SINGULAR_CATEGORIES.find((c) => c.id === id)?.label ?? "Lugar singular";
}

/** Tipos de lugares "comunes" consultados en vivo a OpenStreetMap. */
export const COMMON_TYPES = [
  { id: "pharmacy", label: "Farmacias", color: "#e11d48", osm: ['["amenity"="pharmacy"]'] },
  { id: "fuel", label: "Gasolineras", color: "#57534e", osm: ['["amenity"="fuel"]'] },
  { id: "convenience", label: "Conveniencia", color: "#65a30d", osm: ['["shop"="convenience"]'] },
  { id: "supermarket", label: "Súper", color: "#0d9488", osm: ['["shop"="supermarket"]'] },
  { id: "atm", label: "Cajeros", color: "#7c3aed", osm: ['["amenity"="atm"]', '["amenity"="bank"]'] },
  { id: "hospital", label: "Hospitales", color: "#dc2626", osm: ['["amenity"="hospital"]'] },
  { id: "restaurant", label: "Comida", color: "#ea580c", osm: ['["amenity"="restaurant"]', '["amenity"="fast_food"]', '["amenity"="cafe"]'] },
] as const;

export type CommonTypeId = (typeof COMMON_TYPES)[number]["id"];

export function commonTypeById(id: string) {
  return COMMON_TYPES.find((t) => t.id === id);
}
