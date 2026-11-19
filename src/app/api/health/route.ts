import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/health → latido de la app para monitoreo diario (auditoría
 * 20-nov-2026). Responde SIEMPRE rápido y SIN leer la base de datos: un ping
 * periódico mantendría a Neon despierto y quemaría las horas de cómputo del
 * plan gratis (la autosuspensión tras ~5 min de inactividad es una
 * característica de ahorro, no un fallo).
 *
 *   /api/health        → 200 con estado del proceso (sin DB)
 *   /api/health?db=1   → además hace UN ping barato a la DB y reporta su
 *                        estado (usar solo puntualmente para diagnosticar,
 *                        p. ej. "¿por qué se ve vacía la app?").
 *
 * Un 200 aquí significa: función viva, build correcto, rutas montadas.
 * La salud REAL del contenido se verifica con /api/places (200 + 27 lugares).
 */
export async function GET(req: Request) {
  const started = Date.now();
  const url = new URL(req.url);
  const checkDb = url.searchParams.get("db") === "1";

  const body: Record<string, unknown> = {
    ok: true,
    app: "RutaViva",
    ts: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    latencyMs: 0,
  };

  if (checkDb) {
    try {
      const { db } = await import("@/lib/db");
      await db.$queryRaw`SELECT 1`;
      body.db = "ok";
    } catch (err) {
      body.db = "error";
      body.dbError = err instanceof Error ? err.message.slice(0, 200) : "desconocido";
    }
  }

  body.latencyMs = Date.now() - started;
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
