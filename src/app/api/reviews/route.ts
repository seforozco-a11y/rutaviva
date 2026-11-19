import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ipHashOf } from "@/lib/admin-auth";
import { rateLimited, type RateBucket } from "@/lib/server/rate-limit";
import { validateReviewInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * POST /api/reviews → reseña enviada por un usuario con sus fotos.
 * La reseña y sus fotos quedan PENDING: solo aparecen en el lugar cuando el
 * admin las aprueba desde el panel de administración.
 *
 * Anti-spam (auditoría 20-nov-2026): sin límite, un script podía llenar la
 * cola de moderación con reseñas basura. Máx 8 reseñas por hora por IP
 * pseudonimizada (hash HMAC, nunca la IP en claro) — margen holgado para un
 * usuario real que reseña varios lugares seguidos.
 */
const reviewBuckets = new Map<string, RateBucket>();
const MAX_REVIEWS_PER_HOUR = 8;

export async function POST(req: NextRequest) {
  try {
    // Anti-spam ANTES de parsear el body (las reseñas también pueden llevar
    // fotos base64 de varios MB).
    if (rateLimited(reviewBuckets, ipHashOf(req), MAX_REVIEWS_PER_HOUR)) {
      return NextResponse.json(
        { error: "Recibimos muchas reseñas tuyas hoy. Intenta más tarde." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = validateReviewInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const place = await db.singularPlace.findUnique({
      where: { id: parsed.data.placeId },
      select: { id: true, status: true, active: true },
    });
    if (!place || place.status !== "APPROVED" || !place.active) {
      return NextResponse.json(
        { error: "Este lugar no acepta reseñas por ahora" },
        { status: 404 }
      );
    }

    const created = await db.review.create({
      data: {
        placeId: place.id,
        authorName: parsed.data.authorName,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        status: "PENDING",
        photos: {
          create: parsed.data.photos.map((url) => ({
            url,
            status: "PENDING",
            inline: url.startsWith("data:"),
          })),
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        reviewId: created.id,
        message:
          "¡Gracias! Tu reseña está en revisión y se publicará cuando cumpla los lineamientos.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/reviews POST]", err);
    return NextResponse.json({ error: "No se pudo enviar la reseña" }, { status: 500 });
  }
}
