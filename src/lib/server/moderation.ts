/**
 * Validación de entradas para lugares y reseñas (formatos y principios de
 * publicación de RutaViva). Compartida por los endpoints públicos y de admin.
 */
import { SINGULAR_CATEGORIES } from "@/lib/geo";

export const MAX_PHOTO_CHARS = 2_600_000; // ~1.9 MB binarios en base64
export const MAX_PHOTOS_PER_REVIEW = 3;
export const MAX_PHOTOS_PER_PLACE = 5; // galería de un lugar singular

export type PlaceInput = {
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
  /** Galería completa (0..5). imageUrl siempre es la portada = photos[0]. */
  photos: string[];
  tips: string | null;
  city: string;
  state: string;
};

type Valid<T> = { ok: true; data: T };
type Invalid = { ok: false; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Valida los campos de un lugar (sugerencia de usuario o alta de admin). */
export function validatePlaceInput(body: unknown): Valid<PlaceInput> | Invalid {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Cuerpo inválido" };
  }
  const b = body as Record<string, unknown>;

  const name = str(b.name);
  const description = str(b.description);
  const category = str(b.category) || "otro";
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  const address = str(b.address) || null;
  const imageUrl = str(b.imageUrl) || null;
  const tips = str(b.tips) || null;
  const city = str(b.city) || "Manzanillo";
  const state = str(b.state) || "Colima";

  // Galería: hasta 5 fotos. imageUrl (portada, compatibilidad) se agrega al
  // frente si no viene ya en la lista; photos[0] siempre termina siendo la
  // portada del lugar.
  const rawPhotos = Array.isArray(b.photos) ? b.photos : [];
  const photos: string[] = [];
  for (const p of rawPhotos) {
    const url = str(p);
    if (!isValidPhotoUrl(url)) {
      return { ok: false, error: "Una de las fotos no es válida o pesa demasiado" };
    }
    photos.push(url);
  }
  if (photos.length > MAX_PHOTOS_PER_PLACE) {
    return { ok: false, error: `Máximo ${MAX_PHOTOS_PER_PLACE} fotos por lugar` };
  }
  const imageUrlFinal = imageUrl ?? photos[0] ?? null;
  if (imageUrlFinal && !isValidPhotoUrl(imageUrlFinal)) {
    return { ok: false, error: "La foto no es válida (usa una imagen comprimida o una URL https)" };
  }
  const photosFinal =
    imageUrl && !photos.includes(imageUrl) ? [imageUrl, ...photos] : photos;
  if (photosFinal.length > MAX_PHOTOS_PER_PLACE) {
    return { ok: false, error: `Máximo ${MAX_PHOTOS_PER_PLACE} fotos por lugar` };
  }

  if (name.length < 3 || name.length > 120) {
    return { ok: false, error: "El nombre debe tener entre 3 y 120 caracteres" };
  }
  if (description.length < 10 || description.length > 2000) {
    return { ok: false, error: "La descripción debe tener entre 10 y 2000 caracteres" };
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "Latitud inválida" };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: "Longitud inválida" };
  }
  if (!SINGULAR_CATEGORIES.some((c) => c.id === category)) {
    return { ok: false, error: "Categoría no válida" };
  }
  if (tips && tips.length > 200) {
    return { ok: false, error: "El tip no puede exceder 200 caracteres" };
  }
  if (city.length > 80 || state.length > 80) {
    return { ok: false, error: "Ciudad o estado demasiado largos" };
  }

  return {
    ok: true,
    data: {
      name,
      description,
      category,
      lat,
      lng,
      address,
      imageUrl: imageUrlFinal,
      photos: photosFinal,
      tips,
      city,
      state,
    },
  };
}

export function isValidPhotoUrl(url: string): boolean {
  if (url.startsWith("data:image/")) return url.length <= MAX_PHOTO_CHARS;
  if (url.startsWith("/images/")) return url.length <= 500;
  if (url.startsWith("https://") || url.startsWith("http://")) return url.length <= 2000;
  return false;
}

export type ReviewInput = {
  placeId: string;
  authorName: string;
  rating: number;
  comment: string;
  photos: string[];
};

/** Valida una reseña enviada por un usuario. */
export function validateReviewInput(body: unknown): Valid<ReviewInput> | Invalid {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Cuerpo inválido" };
  }
  const b = body as Record<string, unknown>;

  const placeId = str(b.placeId);
  const authorName = str(b.authorName);
  const rating = Number(b.rating);
  const comment = str(b.comment);
  const rawPhotos = Array.isArray(b.photos) ? b.photos : [];

  if (!placeId) return { ok: false, error: "Falta el lugar de la reseña" };
  if (authorName.length < 2 || authorName.length > 40) {
    return { ok: false, error: "Tu nombre debe tener entre 2 y 40 caracteres" };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "La calificación debe ser de 1 a 5 estrellas" };
  }
  if (comment.length < 5 || comment.length > 800) {
    return { ok: false, error: "El comentario debe tener entre 5 y 800 caracteres" };
  }
  if (rawPhotos.length > MAX_PHOTOS_PER_REVIEW) {
    return { ok: false, error: `Máximo ${MAX_PHOTOS_PER_REVIEW} fotos por reseña` };
  }
  const photos: string[] = [];
  for (const p of rawPhotos) {
    const url = str(p);
    if (!isValidPhotoUrl(url)) {
      return { ok: false, error: "Una de las fotos no es válida o pesa demasiado" };
    }
    photos.push(url);
  }

  return { ok: true, data: { placeId, authorName, rating, comment, photos } };
}
