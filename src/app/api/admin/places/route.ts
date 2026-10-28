import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { validatePlaceInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/places → alta DIRECTA de un lugar por el equipo RutaViva.
 * Nace APPROVED (publicado de inmediato) porque la autorización ya la dio
 * el administrador.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const body = await req.json().catch(() => null);
    const parsed = validatePlaceInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const featured = Boolean((body as Record<string, unknown>)?.featured);

    const { photos, ...placeData } = parsed.data;

    const created = await db.singularPlace.create({
      data: {
        ...placeData,
        featured,
        status: "APPROVED",
        source: "ADMIN",
        // Galería completa; los lugares creados por admin nacen aprobados.
        ...(photos.length > 0
          ? { photos: { create: photos.map((url) => ({ url, status: "APPROVED" })) } }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, placeId: created.id }, { status: 201 });
  } catch (err) {
    console.error("[api/admin/places POST]", err);
    return NextResponse.json({ error: "No se pudo crear el lugar" }, { status: 500 });
  }
}
