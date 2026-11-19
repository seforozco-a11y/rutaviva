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
  // Blindaje doble: la bandera coverInline O el contenido data: → API de
  // imágenes. Así una bandera desincronizada (fila histórica o respaldo
  // viejo) NUNCA vuelve a exponer base64 en los JSON públicos — defecto
  // detectado en producción el 18 nov 2026 (4 portadas de 45-103 KB por
  // carga). La reparación de banderas corre además en cada build de Vercel.
  if (coverInline || isInlineImage(imageUrl)) {
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
  // Mismo blindaje que placeCoverUrl: data: se sirve por la API aunque la
  // bandera inline venga mal (reparación en build + defensa en runtime).
  if (inline || isInlineImage(url)) {
    const v = new Date(createdAt).getTime();
    return `/api/images/photo/${photoId}?v=${Number.isFinite(v) ? v : 0}`;
  }
  return url ?? null;
}

/**
 * ¿Dos URLs apuntan a la MISMA imagen guardada?
 *
 * Comparar strings no basta: una misma imagen puede exponerse como URL ligera
 * del lugar (/api/images/place/[id] — la portada) o como URL ligera de la foto
 * (/api/images/photo/[id] — su fila en la galería). Son rutas distintas para
 * el MISMO contenido, y esa diferencia produjo el defecto del 19 nov 2026:
 * portadas "duplicadas" al editar (el diálogo antepone la portada aunque la
 * galería ya la contiene) y fichas públicas con la misma foto dos veces en el
 * carrusel. Aquí las URLs ligeras de la MISMA entidad (mismo tipo + id) se
 * consideran iguales aunque la versión de caché (?v=) difiera; el resto exige
 * igualdad exacta (data:, /images/…, https).
 */
export function sameImageUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ma = /^\/api\/images\/(place|photo)\/([a-zA-Z0-9]+)/.exec(a);
  const mb = /^\/api\/images\/(place|photo)\/([a-zA-Z0-9]+)/.exec(b);
  return !!ma && !!mb && ma[1] === mb[1] && ma[2] === mb[2];
}
