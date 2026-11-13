import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { buildExcelBackup } from "@/lib/excel-backup";

/**
 * GET /api/admin/backup-excel → respaldo de TODO el contenido en formato
 * Excel (.xlsx) con las fotos INCRUSTADAS en la hoja "Fotos".
 *
 * - Lugares ordenados del más RECIENTE al más antiguo (petición del equipo).
 * - Fotos compactadas con sharp (JPEG ~480 px) para que el archivo sea
 *   descargable dentro del límite de respuesta de Vercel (4.5 MB); si aun
 *   así el archivo queda grande, se reconstruye con miniaturas de 320 px.
 * - El respaldo fiel para RESTAURAR sigue siendo el JSON de /api/admin/backup;
 *   este Excel es el listado de consulta/archivo del equipo.
 *
 * Protegido con la cookie de administrador (misma sesión del panel).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const [places, reports] = await Promise.all([
      // Lugares del MÁS RECIENTE al más antiguo; fotos por orden de galería
      // (order asc, createdAt asc) y reseñas de la más nueva a la más vieja.
      db.singularPlace.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
          reviews: {
            orderBy: { createdAt: "desc" },
            include: { photos: { orderBy: { createdAt: "asc" } } },
          },
        },
      }),
      db.report.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    let built = await buildExcelBackup(places, reports, { maxThumbPx: 480 });
    // Cinturón de seguridad: si el archivo excede el límite práctico de
    // respuesta de Vercel, se reconstruye con miniaturas más compactas.
    if (built.bytes.byteLength > 4_100_000) {
      built = await buildExcelBackup(places, reports, { maxThumbPx: 320 });
    }

    return new NextResponse(built.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${built.filename}"`,
        "Cache-Control": "no-store",
        "X-Backup-Counts": JSON.stringify(built.counts),
      },
    });
  } catch (err) {
    console.error("[api/admin/backup-excel GET]", err);
    return NextResponse.json(
      { error: "No se pudo generar el respaldo en Excel" },
      { status: 500 }
    );
  }
}
