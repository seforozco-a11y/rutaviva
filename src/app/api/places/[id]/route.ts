import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SINGULAR_CATEGORIES } from "@/lib/geo";

export const dynamic = "force-dynamic";

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

    const place = await db.singularPlace.findUnique({
      where: { id },
      include: {
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

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error("[api/places/[id] GET]", err);
    return NextResponse.json({ error: "No se pudo cargar el lugar" }, { status: 500 });
  }
}
