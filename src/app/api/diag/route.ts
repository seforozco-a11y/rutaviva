import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * ⚠️ ENDPOINT DE DIAGNÓSTICO TEMPORAL (auditoría Task 40).
 * Devuelve el estado real de la conexión a la base de datos y a Overpass
 * desde dentro de Vercel. NO expone credenciales (solo hosts). SE ELIMINA
 * al terminar el diagnóstico.
 */
const DIAG_KEY = "ba3e5ae5b385ad1f59da1eae7660c6aa"; // efímero, solo esta auditoría

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== DIAG_KEY) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  // 1) Conexión a la base de datos (error de Prisma tal cual)
  const t0 = Date.now();
  let dbResult: Record<string, unknown>;
  try {
    const one = await db.$queryRawUnsafe<{ ok: number }>("SELECT 1 as ok");
    const t1 = Date.now();
    const places = await db.singularPlace.count();
    const reviews = await db.review.count();
    dbResult = {
      ok: true,
      select1Ms: t1 - t0,
      places,
      reviews,
      totalMs: Date.now() - t0,
    };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    dbResult = {
      ok: false,
      name: (err as Error).constructor?.name ?? "Error",
      code: e.code ?? null,
      message: (e.message ?? String(err)).slice(0, 500),
      totalMs: Date.now() - t0,
    };
  }

  // 2) Host de la base (sin usuario ni contraseña)
  const pgHost = process.env.PGHOST ?? null;
  const dbUrlHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? "x://x").hostname || null;
    } catch {
      return null;
    }
  })();

  // 3) Overpass (el proxy /api/nearby) probado desde dentro de Vercel
  const o0 = Date.now();
  let overpass: Record<string, unknown>;
  try {
    const res = await fetch("https://overpass-api.de/api/status", {
      signal: AbortSignal.timeout(8000),
    });
    const head = (await res.text()).slice(0, 100);
    overpass = { ok: res.ok, status: res.status, ms: Date.now() - o0, head };
  } catch (err) {
    overpass = { ok: false, ms: Date.now() - o0, error: String(err).slice(0, 200) };
  }

  return NextResponse.json({
    ts: new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? "?",
    pgHost,
    dbUrlHost,
    db: dbResult,
    overpass,
  });
}
