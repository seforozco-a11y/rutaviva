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

/**
 * Enlace universal de direcciones de Google Maps (funciona en Android e iOS).
 *
 * IMPORTANTE: `destination` debe ser SIEMPRE `lat,lng` puro (formato oficial
 * de la URL api=1). El sufijo no documentado `lat,lng(Etiqueta)` NO lo parsea
 * Google Maps: muestra el string crudo en el campo destino, clava el pin en
 * ese punto exacto y si cae en el agua (p. ej. la punta de una escollera)
 * devuelve "No se encuentra una ruta". Con coordenadas puras, el geocodificador
 * las resuelve al POI/dirección más cercana y traza la ruta sin problema.
 */
export function directionsUrl(dest: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`;
}

/** Categorías de lugares singulares (extensible desde la base de datos). */
export const SINGULAR_CATEGORIES = [
  { id: "playa", label: "Playa" },
  { id: "naturaleza", label: "Naturaleza" },
  { id: "mirador", label: "Mirador" },
  { id: "monumento", label: "Monumento" },
  { id: "plaza", label: "Plaza histórica" },
  { id: "gastronomia", label: "Gastronomía" },
  { id: "museo", label: "Museo" },
  { id: "parque", label: "Parque" },
  { id: "cultura", label: "Cultura" },
  // Infraestructura del municipio que el visitante acaba necesitando:
  // hospital/centro de salud, policía turística, presidencia municipal,
  // correos, protección civil, módulos de información…
  { id: "servicios", label: "Servicios Públicos" },
  { id: "otro", label: "Otro" },
] as const;

export type SingularCategoryId = (typeof SINGULAR_CATEGORIES)[number]["id"];

export function categoryLabel(id: string): string {
  return SINGULAR_CATEGORIES.find((c) => c.id === id)?.label ?? "Lugar singular";
}

/**
 * Categorías reordenadas por cercanía a la ubicación del usuario: primero
 * las que tienen MÁS lugares dentro del radio dado (1 km por defecto) —
 * si Gastronomía tiene 15 lugares cerca, Monumento 10 y Parque 2, el
 * orden de los chips queda Gastronomía → Monumento → Parque… — y al final
 * las categorías sin lugares cerca. «Cerca de mí» no participa: siempre
 * es el primer chip fijo del mapa.
 *
 * Desempates: gana la categoría con más lugares en total (que exista aquí,
 * aunque estén lejos del radio); si sigue el empate, se conserva el orden
 * definido arriba (Array.prototype.sort es estable).
 */
export function categoriesByProximity(
  places: ReadonlyArray<{ category: string; distanceKm: number | null | undefined }>,
  radiusKm = 1,
): (typeof SINGULAR_CATEGORIES)[number][] {
  const stats = new Map<string, { near: number; total: number }>();
  for (const p of places) {
    const s = stats.get(p.category) ?? { near: 0, total: 0 };
    s.total += 1;
    if (p.distanceKm != null && p.distanceKm <= radiusKm) s.near += 1;
    stats.set(p.category, s);
  }
  return [...SINGULAR_CATEGORIES].sort((a, b) => {
    const sa = stats.get(a.id);
    const sb = stats.get(b.id);
    const nearA = sa?.near ?? 0;
    const nearB = sb?.near ?? 0;
    if (nearA !== nearB) return nearB - nearA;
    return (sb?.total ?? 0) - (sa?.total ?? 0);
  });
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
