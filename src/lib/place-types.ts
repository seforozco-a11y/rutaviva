/** Tipos compartidos entre cliente y servidor para RutaViva. */

export type Coordinates = { lat: number; lng: number };

export type SingularPlaceDTO = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
  tips: string | null;
  featured: boolean;
  distanceKm: number | null;
  createdAt: string;
};

export type NearbyPlaceDTO = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  distanceKm: number;
};

/** Detalle unificado para el bottom-sheet. */
export type PlaceDetail = {
  kind: "singular" | "common";
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  categoryLabel: string;
  color?: string;
  description?: string;
  address?: string | null;
  tips?: string | null;
  imageUrl?: string | null;
};

/** Punto de respaldo (Zócalo, CDMX) si el GPS se deniega o no está disponible. */
export const DEMO_ORIGIN: Coordinates = { lat: 19.4326, lng: -99.1332 };
