/**
 * Servidor de imágenes inline (base64) con optimización y caché.
 *
 * Cada petición a /api/images/... pasa por aquí:
 *  1. Caché en memoria de la función (WebP ya convertido, TTL 10 min):
 *     evita recomprimir y evita releer el base64 de la DB en picos.
 *  2. Conversión con sharp a WebP máx 720×720 q72 (~30-60 KB por foto típica).
 *  3. Respuesta con Cache-Control inmutable de 1 año: la URL lleva ?v= con la
 *     versión de la fila, así que un cambio de foto cambia la URL y el CDN
 *     nunca sirve una imagen vieja.
 *
 * Con el CDN de Vercel delante, la DB recibe como máximo UNA lectura por
 * imagen por región por versión — independientemente de cuántos usuarios
 * abran la app.
 */
import { NextResponse } from "next/server";
import sharp from "sharp";

const IMAGE_CACHE_TTL = 10 * 60_000;
const IMAGE_CACHE_MAX = 40;

const imageCache = new Map<string, { ts: number; bytes: Uint8Array }>();

function imageResponse(bytes: Uint8Array): NextResponse {
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable, s-maxage=31536000",
    },
  });
}

/**
 * Sirve un data URL (p. ej. "data:image/jpeg;base64,...") como WebP optimizado.
 * Si sharp falla (imagen corrupta), responde el original sin transformar.
 */
export async function serveInlineImage(dataUrl: string, cacheKey: string): Promise<NextResponse> {
  const hit = imageCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < IMAGE_CACHE_TTL) {
    return imageResponse(hit.bytes);
  }

  const comma = dataUrl.indexOf(",");
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const raw = Buffer.from(b64, "base64");

  let bytes: Uint8Array;
  try {
    const webp = await sharp(raw)
      .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer();
    bytes = new Uint8Array(webp);
  } catch {
    // Imagen corrupta o formato no soportado: sirve el original tal cual.
    bytes = new Uint8Array(raw);
    const res = imageResponse(bytes);
    const mime = /^data:image\/([a-z+]+)/.exec(meta)?.[1];
    if (mime) res.headers.set("Content-Type", `image/${mime}`);
    return res;
  }

  // Higiene del mapa de caché.
  if (imageCache.size >= IMAGE_CACHE_MAX) {
    const now = Date.now();
    for (const [k, v] of imageCache) {
      if (now - v.ts > IMAGE_CACHE_TTL) imageCache.delete(k);
    }
    if (imageCache.size >= IMAGE_CACHE_MAX) {
      const oldest = imageCache.keys().next().value;
      if (oldest !== undefined) imageCache.delete(oldest);
    }
  }
  imageCache.set(cacheKey, { ts: Date.now(), bytes });

  return imageResponse(bytes);
}

/** Invalida la caché de una imagen (usado tras editar contenido, p. ej. restore). */
export function invalidateImageCache(keyPrefix: string): void {
  for (const k of imageCache.keys()) {
    if (k.startsWith(keyPrefix)) imageCache.delete(k);
  }
}
