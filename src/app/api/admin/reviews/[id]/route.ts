import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/reviews/[id]
 * action "approve"      → publica la reseña y sus fotos en el lugar.
 * action "reject"       → la descarta (no se publica).
 * action "dismiss-flag" → descarta el reporte de usuario: la reseña vuelve a
 *                         ser visible (si estaba APPROVED).
 * Nota: approve y reject también limpian el flag del reporte para que ninguna
 * reseña validada quede oculta por un reporte ya resuelto (política UGC).
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

    if (action !== "approve" && action !== "reject" && action !== "dismiss-flag") {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    const review = await db.review.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
    }

    if (action === "dismiss-flag") {
      // El equipo decide que la reseña está bien: se quita el reporte y vuelve
      // a ser visible para el público (si su status es APPROVED).
      await db.review.update({
        where: { id },
        data: { flagged: false, flagReason: null, flaggedAt: null },
      });
      return NextResponse.json({ ok: true, action });
    }

    const status = action === "approve" ? "APPROVED" : "REJECTED";
    await db.review.update({
      where: { id },
      data: { status, flagged: false, flagReason: null, flaggedAt: null },
    });
    await db.photo.updateMany({ where: { reviewId: id }, data: { status } });

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error("[api/admin/reviews/[id] PATCH]", err);
    return NextResponse.json({ error: "No se pudo actualizar la reseña" }, { status: 500 });
  }
}

/** DELETE /api/admin/reviews/[id] → eliminación definitiva de la reseña. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    await db.review.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/reviews/[id] DELETE]", err);
    return NextResponse.json({ error: "No se pudo eliminar la reseña" }, { status: 500 });
  }
}
