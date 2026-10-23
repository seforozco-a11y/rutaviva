import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateReviewInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * POST /api/reviews → reseña enviada por un usuario con sus fotos.
 * La reseña y sus fotos quedan PENDING: solo aparecen en el lugar cuando el
 * admin las aprueba desde el panel de administración.
 */
export async function POST(req: NextRequest) {
  try {
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
          create: parsed.data.photos.map((url) => ({ url, status: "PENDING" })),
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
