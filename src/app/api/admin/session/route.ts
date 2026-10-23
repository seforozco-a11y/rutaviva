import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/session → indica si hay sesión de administrador activa. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAdminRequest(req) });
}
