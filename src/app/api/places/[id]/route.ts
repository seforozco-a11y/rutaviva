import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SINGULAR_CATEGORIES } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * Caché en memoria por lugar (Task 40, límite de transferencia de Neon):
 * el detalle incluye fotos y reseñas con base64, y cada vista de ficha lo
 * transfería completo desde la DB. Con esta caché + caché de borde, cada
 * ficha lee la DB como máximo 1 vez por minuto por instancia.
 */
const DETAIL_CACHE_TTL = 60_000;
const detailCache = new Map<string, { ts: number; body: Record<string, unknown> }>();

/**
 * GET /api/places/[id] → detalle público de un lugar + reseñas APROBADAS
 * (con sus fotos aprobadas). Las reseñas reportadas por usuarios (flagged,
 * mecanismo "Reportar reseña" de la política UGC de Google Play) se excluyen
 * mientras el equipo las revisa. Si el lugar está PENDING/REJECTED responde
 * 404: el público solo ve contenido validado por el equipo RutaViva.
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
      include: {
        // Galería pública del lugar (fotos aprobadas, portada primero).
        photos: {
          where: { status: "APPROVED" },
          orderBy: { createdAt: "asc" },
          select: { id: true, url: true },
        },
        reviews: {
          where: { status: "APPROVED", flagged: false },
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            photos: {
              where: { status: "APPROVED" },
              select: { id: true, url: true },
            },
          },
        },
      },
    });

    if (!place || place.status !== "APPROVED" || !place.active) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }

    const ratings = place.reviews.map((r) => r.rating);
    const ratingCount = ratings.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratingCount) * 10) / 10
        : null;

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
        imageUrl: place.imageUrl,
        // Galería: portada (imageUrl) primero, luego las fotos aprobadas que
        // no la dupliquen (p. ej. sugerencias de usuarios con 5 fotos).
        photos: [
          ...(place.imageUrl && !place.photos.some((p) => p.url === place.imageUrl)
            ? [{ id: "cover", url: place.imageUrl }]
            : []),
          ...place.photos.map((p) => ({ id: p.id, url: p.url })),
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
        photos: r.photos.map((p) => ({ id: p.id, url: p.url })),
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
