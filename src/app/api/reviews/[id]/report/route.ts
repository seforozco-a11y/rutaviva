import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/reviews/[id]/report
 *
 * Mecanismo de reporte de contenido in-app (requisito de la política de
 * contenido UGC de Google Play): cualquier usuario puede reportar una reseña
 * sin necesidad de cuenta. La reseña marcada (flagged=true) deja de mostrarse
 * al público de inmediato y pasa a la cola "Reseñas reportadas" del panel del
 * equipo RutaViva, que decide si la restaura (dismiss-flag) o la rechaza.
 *
 * Body: { reason?: string } — motivo opcional, máximo 300 caracteres.
 * Respuestas: 200 { ok: true } | 400 motivo inválido | 404 reseña inexistente.
 * Es público (sin auth): reportar no requiere sesión de usuario.
 */
const MAX_REASON_LENGTH = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { reason?: unknown } | null;

    let reason: string | null = null;
    if (body?.reason != null && String(body.reason).trim() !== "") {
      const trimmed = String(body.reason).trim();
      if (trimmed.length > MAX_REASON_LENGTH) {
        return NextResponse.json(
          { error: `El motivo no puede exceder ${MAX_REASON_LENGTH} caracteres.` },
          { status: 400 }
        );
      }
      reason = trimmed;
    }

    const review = await db.review.findUnique({ where: { id }, select: { id: true } });
    if (!review) {
      return NextResponse.json({ error: "Reseña no encontrada" }, { status: 404 });
    }

    // Si ya estaba reportada, se actualiza motivo y fecha del último reporte.
    await db.review.update({
      where: { id },
      data: {
        flagged: true,
        flagReason: reason,
        flaggedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/reviews/[id]/report POST]", err);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
