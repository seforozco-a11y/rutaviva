/**
 * Autenticación del panel de administración (equipo RutaViva).
 *
 * MVP: PIN + cookie httpOnly firmada con HMAC (ADMIN_SECRET).
 * Para producción conviene migrar a NextAuth con usuarios/roles reales;
 * la interfaz `isAdminRequest` ya está pensada para ese cambio.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "rv_admin";
const SECRET = process.env.ADMIN_SECRET || "rutaviva-dev-secret";
const PIN = process.env.ADMIN_PIN || "rutaviva2025";

export function adminToken(): string {
  return crypto.createHmac("sha256", SECRET).update("admin-v1").digest("hex");
}

export function pinIsValid(pin: unknown): boolean {
  if (typeof pin !== "string") return false;
  // Tolerante a errores de tecleo: se compara normalizado (sin espacios
  // accidentales y sin distinguir mayúsculas/minúsculas) en tiempo constante.
  const a = Buffer.from(pin.trim().toUpperCase());
  const b = Buffer.from(PIN.trim().toUpperCase());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verifica la cookie del request contra el token esperado. */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const expected = adminToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Respuesta 401 estándar para endpoints de admin. */
export function unauthorized() {
  return Response.json({ error: "No autorizado. Inicia sesión como administrador." }, { status: 401 });
}
