import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { placeCoverUrl } from "@/lib/image-urls";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview → todo lo que el equipo RutaViva necesita para
 * moderar: estadísticas, sugerencias de lugares PENDING, reseñas PENDING
 * (con fotos), reseñas REPORTADAS por usuarios (flagged — política UGC de
 * Google Play), REPORTES de lugares y comentarios de la app (Report) y el
 * catálogo completo con su estado.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const [placesTotal, placesPublished, pendingPlaces, pendingReviews, reviewsTotal, flaggedReviews, failedLogins24h, openReports] =
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
        // Reportes de lugares + comentarios de la app (PENDING): el canal de
        // feedback de los usuarios sobre el contenido y el funcionamiento.
        db.report.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);

    const allPlaces = await db.singularPlace.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 300,
      // SIN imageUrl: portadas base64 de hasta 150 KB por fila no viajan a la
      // lambda; la URL ligera se arma con coverInline + updatedAt.
      select: {
        id: true,
        name: true,
        category: true,
        lat: true,
        lng: true,
        address: true,
        tips: true,
        featured: true,
        active: true,
        status: true,
        source: true,
        suggestedBy: true,
        city: true,
        state: true,
        description: true,
        coverInline: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { reviews: true, photos: true } },
        reviews: { where: { status: "APPROVED" }, select: { rating: true } },
      },
    });

    // Portadas no inline (estáticas/https): segunda lectura barata.
    const coverNonInlineIds = allPlaces.filter((p) => !p.coverInline).map((p) => p.id);
    const coverStatic = new Map<string, string>();
    if (coverNonInlineIds.length > 0) {
      const raws = await db.singularPlace.findMany({
        where: { id: { in: coverNonInlineIds } },
        select: { id: true, imageUrl: true },
      });
      for (const r of raws) if (r.imageUrl) coverStatic.set(r.id, r.imageUrl);
    }

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
        // Inline → /api/images/place/[id]; estática/https → su propia URL.
        imageUrl: placeCoverUrl(p.id, coverStatic.get(p.id) ?? null, p.coverInline, p.updatedAt),
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
        reportsOpen: openReports.length,
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
      reports: openReports.map((r) => ({
        id: r.id,
        kind: r.kind,
        placeId: r.placeId,
        placeName: r.placeName,
        reason: r.reason,
        detail: r.detail,
        contact: r.contact,
        meta: r.meta,
        createdAt: r.createdAt.toISOString(),
      })),
      allPlaces: allPlacesDto,
    });
  } catch (err) {
    console.error("[api/admin/overview]", err);
    return NextResponse.json({ error: "No se pudo cargar el panel" }, { status: 500 });
  }
}
