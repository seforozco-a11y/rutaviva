import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/reports/[id]
 * action:
 *  - "resolve" → el equipo atendió el reporte (corrigió el lugar, etc.)
 *  - "dismiss" → descartado sin cambios (falso alarma, pruebo y está bien…)
 * Ninguna acción borra el registro: queda como bitácora de moderación.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { action?: unknown } | null;
    const action = String(body?.action ?? "");

    if (action !== "resolve" && action !== "dismiss") {
      return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
    }

    const exists = await db.report.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 });
    }

    await db.report.update({
      where: { id },
      data: { status: action === "resolve" ? "RESOLVED" : "DISMISSED", resolvedAt: new Date() },
    });

    return NextResponse.json({ ok: true, action });
  } catch (err) {
    console.error("[api/admin/reports/[id] PATCH]", err);
    return NextResponse.json({ error: "No se pudo actualizar el reporte" }, { status: 500 });
  }
}
