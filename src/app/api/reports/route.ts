import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ipHashOf } from "@/lib/admin-auth";
import { validateReportInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * POST /api/reports → REPORTES y COMENTARIOS de usuarios (sin cuenta).
 *
 * Dos tipos (kind):
 *  - PLACE: "¿Información incorrecta?" en la ficha de un lugar — avisa de
 *    ubicaciones erróneas, lugares cerrados, fotos que no corresponden…
 *    El reporte NO oculta el lugar: entra a la cola del panel y el equipo
 *    corrige o descarta.
 *  - APP: "Ayuda y comentarios" (chip en el mapa) — errores de
 *    funcionamiento, ideas y quejas sobre contenido publicado.
 *
 * El motivo llega predefinido (REPORT_REASONS) para que los reportes sean
 * precisos; el detalle y el contacto son opcionales.
 *
 * Anti-spam: límite en memoria por IP pseudonimizada (hash HMAC, nunca la IP
 * en claro) — MAX_REPORTS_PER_HOUR por hora. No requiere autenticación.
 */
const MAX_REPORTS_PER_HOUR = 10;

// Límite en memoria (por instancia del serverless; suficiente contra spam
// casual: la cola del panel es privada y los reportes no son públicos).
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    // Limpieza perezosa para que el Map no crezca indefinidamente.
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt < now) rateBuckets.delete(k);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_REPORTS_PER_HOUR;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = validateReportInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { kind, placeId, reason, detail, contact, meta } = parsed.data;

    if (rateLimited(ipHashOf(req))) {
      return NextResponse.json(
        { error: "Recibimos muchos reportes tuyos hoy. Intenta más tarde." },
        { status: 429 }
      );
    }

    // Para reportes de lugar: verificar que exista y guardar su nombre como
    // snapshot (el reporte sobrevive aunque el lugar se elimine después).
    let placeName: string | null = null;
    if (kind === "PLACE" && placeId) {
      const place = await db.singularPlace.findUnique({
        where: { id: placeId },
        select: { name: true },
      });
      if (!place) {
        return NextResponse.json({ error: "El lugar ya no existe" }, { status: 404 });
      }
      placeName = place.name;
    }

    await db.report.create({
      data: {
        kind,
        placeId: kind === "PLACE" ? placeId : null,
        placeName,
        reason,
        detail,
        contact,
        meta,
      },
    });

    return NextResponse.json(
      { ok: true, message: "¡Gracias! Nuestro equipo revisará tu reporte." },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/reports POST]", err);
    return NextResponse.json({ error: "No se pudo enviar el reporte" }, { status: 500 });
  }
}
