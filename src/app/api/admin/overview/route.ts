import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview → todo lo que el equipo RutaViva necesita para
 * moderar: estadísticas, sugerencias de lugares PENDING, reseñas PENDING
 * (con fotos), reseñas REPORTADAS por usuarios (flagged — política UGC de
 * Google Play) y el catálogo completo con su estado.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const [placesTotal, placesPublished, pendingPlaces, pendingReviews, reviewsTotal, flaggedReviews, failedLogins24h] =
      await Promise.all([
        db.singularPlace.count(),
        db.singularPlace.count({ where: { status: "APPROVED", active: true } }),
        db.singularPlace.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          include: { photos: { orderBy: { createdAt: "asc" } } },
        }),
        db.review.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          include: {
            photos: { orderBy: { createdAt: "asc" } },
            place: { select: { id: true, name: true } },
          },
        }),
        db.review.count(),
        db.review.findMany({
          // Reportes de usuarios (mecanismo UGC de Google Play): las reseñas
          // marcadas quedan ocultas al público hasta que el equipo decide.
          where: { flagged: true },
          orderBy: { flaggedAt: "desc" },
          include: {
            photos: { orderBy: { createdAt: "asc" } },
            place: { select: { id: true, name: true } },
          },
        }),
        // Seguridad: intentos fallidos de login del panel en las últimas 24 h
        // (visibilidad para el equipo; el registro completo se purga a las 48 h).
        db.adminLoginLog.count({
          where: { success: false, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);

    const allPlaces = await db.singularPlace.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 300,
      include: {
        _count: { select: { reviews: true, photos: true } },
        reviews: { where: { status: "APPROVED" }, select: { rating: true } },
      },
    });

    const allPlacesDto = allPlaces.map((p) => {
      const ratings = p.reviews.map((r) => r.rating);
      const ratingCount = ratings.length;
      const ratingAvg =
        ratingCount > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratingCount) * 10) / 10
          : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        imageUrl: p.imageUrl,
        tips: p.tips,
        featured: p.featured,
        active: p.active,
        status: p.status,
        source: p.source,
        suggestedBy: p.suggestedBy,
        city: p.city,
        state: p.state,
        description: p.description,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        reviewsCount: p._count.reviews,
        photosCount: p._count.photos,
        ratingAvg,
        ratingCount,
      };
    });

    return NextResponse.json({
      stats: {
        placesTotal,
        placesPublished,
        pendingPlaces: pendingPlaces.length,
        pendingReviews: pendingReviews.length,
        reviewsTotal,
        flaggedReviews: flaggedReviews.length,
        failedLogins24h,
      },
      pendingPlaces: pendingPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        address: p.address,
        tips: p.tips,
        suggestedBy: p.suggestedBy,
        city: p.city,
        state: p.state,
        createdAt: p.createdAt.toISOString(),
        photos: p.photos.map((ph) => ({ id: ph.id, url: ph.url, status: ph.status })),
      })),
      pendingReviews: pendingReviews.map((r) => ({
        id: r.id,
        placeId: r.placeId,
        placeName: r.place.name,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
        photos: r.photos.map((ph) => ({ id: ph.id, url: ph.url, status: ph.status })),
      })),
      flaggedReviews: flaggedReviews.map((r) => ({
        id: r.id,
        placeId: r.placeId,
        placeName: r.place.name,
        authorName: r.authorName,
        rating: r.rating,
        comment: r.comment,
        status: r.status,
        reason: r.flagReason,
        flaggedAt: r.flaggedAt ? r.flaggedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        photos: r.photos.map((ph) => ({ id: ph.id, url: ph.url, status: ph.status })),
      })),
      allPlaces: allPlacesDto,
    });
  } catch (err) {
    console.error("[api/admin/overview]", err);
    return NextResponse.json({ error: "No se pudo cargar el panel" }, { status: 500 });
  }
}
