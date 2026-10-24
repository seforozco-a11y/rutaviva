import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { validatePlaceInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/places/[id]
 * action:
 *  - "approve" → publica la sugerencia (status APPROVED); aprueba sus fotos y
 *    si no tiene portada, usa la primera foto recibida (formato mínimo para
 *    publicar: una imagen).
 *  - "reject"  → descarta la sugerencia (status REJECTED).
 *  - "feature" / "unfeature" → destacar o quitar destaque.
 *  - "update"  → edita campos (validados con los mismos formatos de publicación).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action ?? "");

    const place = await db.singularPlace.findUnique({
      where: { id },
      include: { photos: { orderBy: { createdAt: "asc" } } },
    });
    if (!place) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }

    if (action === "approve") {
      const firstPending = place.photos.find((p) => p.status === "PENDING");
      await db.photo.updateMany({
        where: { placeId: id, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      await db.singularPlace.update({
        where: { id },
        data: {
          status: "APPROVED",
          active: true,
          ...( !place.imageUrl && firstPending ? { imageUrl: firstPending.url } : {}),
        },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "reject") {
      await db.photo.updateMany({
        where: { placeId: id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await db.singularPlace.update({
        where: { id },
        data: { status: "REJECTED", active: false },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "feature" || action === "unfeature") {
      await db.singularPlace.update({
        where: { id },
        data: { featured: action === "feature" },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "update") {
      const parsed = validatePlaceInput(body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const featured =
        typeof body?.featured === "boolean" ? body.featured : place.featured;
      await db.singularPlace.update({
        where: { id },
        data: { ...parsed.data, featured },
      });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/places/[id] PATCH]", err);
    return NextResponse.json({ error: "No se pudo actualizar el lugar" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/places/[id] → eliminación definitiva (cascada de reseñas
 * y fotos). Para "no publicar" sin borrar, usar action "reject".
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    await db.singularPlace.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/places/[id] DELETE]", err);
    return NextResponse.json({ error: "No se pudo eliminar el lugar" }, { status: 500 });
  }
}
