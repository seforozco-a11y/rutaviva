import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, pinIsValid } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/login { pin } → cookie httpOnly del equipo RutaViva. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const pin = (body as Record<string, unknown> | null)?.pin;

    if (!pinIsValid(pin)) {
      return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, adminToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 horas
    });
    return res;
  } catch (err) {
    console.error("[api/admin/login]", err);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
