import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SINGULAR_CATEGORIES } from "@/lib/geo";
import { photoImageUrl, placeCoverUrl } from "@/lib/image-urls";

export const dynamic = "force-dynamic";

/**
 * Caché en memoria por lugar (Task 40, límite de transferencia de Neon):
 * cada ficha lee la DB como máximo 1 vez por minuto por instancia.
 */
const DETAIL_CACHE_TTL = 60_000;
const detailCache = new Map<string, { ts: number; body: Record<string, unknown> }>();

/**
 * GET /api/places/[id] → detalle público de un lugar + reseñas APROBADAS
 * (con sus fotos aprobadas). Las reseñas reportadas por usuarios (flagged,
 * mecanismo "Reportar reseña" de la política UGC de Google Play) se excluyen
 * mientras el equipo las revisa. Si el lugar está PENDING/REJECTED responde
 * 404: el público solo ve contenido validado por el equipo RutaViva.
 *
 * Blindaje de transferencia: las fotos inline (base64) NUNCA se leen de la DB
 * aquí — solo sus ids + flags; el JSON expone rutas /api/images/... que sirven
 * la imagen convertida a WebP con caché inmutable. Solo las fotos con URL
 * normal (estática/https, ≤ 2000 chars) se leen en una segunda pasada.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const hit = detailCache.get(id);
    if (hit && Date.now() - hit.ts < DETAIL_CACHE_TTL) {
      const cached = NextResponse.json(hit.body);
      cached.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
      return cached;
    }

    const place = await db.singularPlace.findUnique({
      where: { id },
      // SIN imageUrl ni photos.url: los base64 pueden pesar 150 KB por fila.
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        lat: true,
        lng: true,
        address: true,
        tips: true,
        featured: true,
        city: true,
        state: true,
        status: true,
        active: true,
        coverInline: true,
        updatedAt: true,
        photos: {
          // Galería pública del lugar (fotos aprobadas y NO apartadas en el
          // baúl, en el orden que el equipo definió; order 0 = portada).
          where: { status: "APPROVED", archived: false },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, inline: true, createdAt: true },
        },
        reviews: {
          where: { status: "APPROVED", flagged: false },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            authorName: true,
            rating: true,
            comment: true,
            createdAt: true,
            photos: {
              where: { status: "APPROVED" },
              select: { id: true, inline: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!place || place.status !== "APPROVED" || !place.active) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }

    // Portada: inline → ruta API; normal → segunda lectura barata.
    const coverUrl = place.coverInline
      ? placeCoverUrl(place.id, null, true, place.updatedAt)
      : (
          await db.singularPlace.findUnique({
            where: { id },
            select: { imageUrl: true },
          })
        )?.imageUrl ?? null;

    // Fotos no inline (estáticas/https): una sola segunda lectura para todas.
    const nonInlineIds = [
      ...place.photos.filter((p) => !p.inline).map((p) => p.id),
      ...place.reviews.flatMap((r) => r.photos.filter((p) => !p.inline).map((p) => p.id)),
    ];
    const staticUrls = new Map<string, string>();
    if (nonInlineIds.length > 0) {
      const raws = await db.photo.findMany({
        where: { id: { in: nonInlineIds } },
        select: { id: true, url: true },
      });
      for (const r of raws) if (r.url) staticUrls.set(r.id, r.url);
    }

    const ratings = place.reviews.map((r) => r.rating);
    const ratingCount = ratings.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratingCount) * 10) / 10
        : null;

    const galleryUrls = place.photos.map((p) => ({
      id: p.id,
      url: photoImageUrl(p.id, staticUrls.get(p.id) ?? null, p.inline, p.createdAt)!,
    }));

    const body = {
      place: {
        id: place.id,
        name: place.name,
        description: place.description,
        category: place.category,
        categoryLabel:
          SINGULAR_CATEGORIES.find((c) => c.id === place.category)?.label ?? "Lugar singular",
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        imageUrl: coverUrl,
        // Galería: portada (imageUrl) primero, luego las fotos aprobadas que
        // no la dupliquen (p. ej. sugerencias de usuarios con 5 fotos).
        photos: [
          ...(coverUrl && !galleryUrls.some((p) => p.url === coverUrl)
            ? [{ id: "cover", url: coverUrl }]
            : []),
          ...galleryUrls,
        ],
        tips: place.tips,
        featured: place.featured,
        city: place.city,
        state: place.state,
        ratingAvg,
        ratingCount,
      },
      reviews: place.reviews.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        photos: r.photos.map((p) => ({
          id: p.id,
          url: photoImageUrl(p.id, staticUrls.get(p.id) ?? null, p.inline, p.createdAt)!,
        })),
      })),
    };

    // Higiene del mapa de caché: si crece mucho, expulsa entradas vencidas.
    if (detailCache.size > 100) {
      for (const [k, v] of detailCache) {
        if (Date.now() - v.ts > DETAIL_CACHE_TTL) detailCache.delete(k);
      }
    }
    detailCache.set(id, { ts: Date.now(), body });

    const res = NextResponse.json(body);
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (err) {
    console.error("[api/places/[id] GET]", err);
    return NextResponse.json({ error: "No se pudo cargar el lugar" }, { status: 500 });
  }
}
