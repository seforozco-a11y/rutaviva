/**
 * Resolución de URLs ligeras para imágenes almacenadas en la base.
 *
 * Problema que resuelve (lección del 7-8 nov 2026): las fotos subidas desde la
 * app viven como data URLs base64 dentro de la fila. Si el JSON público las
 * incluye tal cual, cada carga de la app transfiere cientos de KB desde Neon —
 * el patrón que agotó los 5 GB de transferencia del plan gratis.
 *
 * Solución: los JSON públicos devuelven una RUTA a la API de imágenes
 * (/api/images/...), que sirve la foto ya convertida a WebP con caché
 * inmutable de 1 año en el CDN. El base64 solo viaja DB → función la primera
 * vez por región y versión; el navegador y el CDN lo sirven el resto del mes.
 *
 * Las imágenes NO inline (rutas estáticas /images/... o https) pasan intactas:
 * ya son ligeras y las sirve el CDN estático.
 */

/** ¿La imagen está incrustada como data URL base64? */
export function isInlineImage(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("data:");
}

/**
 * URL pública de la portada de un lugar. `updatedAt` (ISO) actúa como versión
 * de caché: si el admin cambia la foto, la URL cambia y se invalida sola.
 */
export function placeCoverUrl(
  placeId: string,
  imageUrl: string | null | undefined,
  coverInline: boolean,
  updatedAt: string | Date
): string | null {
  if (coverInline) {
    const v = new Date(updatedAt).getTime();
    return `/api/images/place/${placeId}?v=${Number.isFinite(v) ? v : 0}`;
  }
  return imageUrl ?? null;
}

/**
 * URL pública de una foto (galería o reseña). `createdAt` (ISO) actúa como
 * versión: las fotos no se editan, así que su URL es inmutable.
 */
export function photoImageUrl(
  photoId: string,
  url: string | null | undefined,
  inline: boolean,
  createdAt: string | Date
): string | null {
  if (inline) {
    const v = new Date(createdAt).getTime();
    return `/api/images/photo/${photoId}?v=${Number.isFinite(v) ? v : 0}`;
  }
  return url ?? null;
}
