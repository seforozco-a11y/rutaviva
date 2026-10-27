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
  ratingAvg: number | null;
  ratingCount: number;
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

/** Reseña pública (ya validada por el equipo RutaViva). */
export type PublicReviewDTO = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  photos: Array<{ id: string; url: string }>;
};

/** Respuesta de GET /api/places/[id]. */
export type PlaceDetailResponse = {
  place: {
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
    city: string;
    state: string;
    ratingAvg: number | null;
    ratingCount: number;
  };
  reviews: PublicReviewDTO[];
};

/** Detalle unificado para el bottom-sheet. */
export type PlaceDetail = {
  kind: "singular" | "common";
  id: string;
  name: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
  /** Id de categoría (solo singular): playa, mirador… — para icono/color. */
  category?: string;
  categoryLabel: string;
  color?: string;
  description?: string;
  address?: string | null;
  tips?: string | null;
  imageUrl?: string | null;
};

/** Punto de respaldo (Centro Histórico de Manzanillo, Colima) si el GPS se deniega o no está disponible. */
export const DEMO_ORIGIN: Coordinates = { lat: 19.0536, lng: -104.3149 };
