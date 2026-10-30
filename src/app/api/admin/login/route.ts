import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, ipHashOf, pinIsValid } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Anti fuerza bruta: tras MAX_FAILS intentos fallidos en WINDOW_MS, la IP
 * (pseudonimizada como hash) queda bloqueada hasta que el fallo más antiguo
 * salga de la ventana. El registro se purga a las RETENTION_MS (48 h). */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const RETENTION_MS = 48 * 60 * 60 * 1000; // 48 horas

/** POST /api/admin/login { pin } → cookie httpOnly del equipo RutaViva.
 * Cada intento (éxito o fallo) se registra pseudonimizado para bloquear
 * ataques de fuerza bruta y dar visibilidad al equipo. */
export async function POST(req: NextRequest) {
  try {
    const ipHash = ipHashOf(req);
    const now = Date.now();

    const [recentFails] = await Promise.all([
      db.adminLoginLog.count({
        where: { ipHash, success: false, createdAt: { gte: new Date(now - WINDOW_MS) } },
      }),
      // Purga de registros vencidos (barata: índice por createdAt).
      db.adminLoginLog.deleteMany({
        where: { createdAt: { lt: new Date(now - RETENTION_MS) } },
      }),
    ]);

    if (recentFails >= MAX_FAILS) {
      const oldestFail = await db.adminLoginLog.findFirst({
        where: { ipHash, success: false, createdAt: { gte: new Date(now - WINDOW_MS) } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });
      const waitMin = oldestFail
        ? Math.max(1, Math.ceil((oldestFail.createdAt.getTime() + WINDOW_MS - now) / 60000))
        : Math.ceil(WINDOW_MS / 60000);
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos. Por seguridad, espera ${waitMin} min y vuelve a intentar.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const pin = (body as Record<string, unknown> | null)?.pin;
    const ok = pinIsValid(pin);

    await db.adminLoginLog.create({ data: { ipHash, success: ok } });

    if (!ok) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    // Éxito: limpia los fallos previos de esta IP (un equipo real que se
    // equivocó al teclear no arrastra sus errores a la próxima ventana).
    await db.adminLoginLog.deleteMany({ where: { ipHash, success: false } });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, adminToken(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // solo viaja por HTTPS en prod
      path: "/",
      maxAge: 60 * 60 * 12, // 12 horas; el token caduca solo (ver admin-auth)
    });
    return res;
  } catch (err) {
    console.error("[api/admin/login]", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
