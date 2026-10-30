/**
 * Autenticación del panel de administración (equipo RutaViva).
 *
 * MVP: PIN + cookie httpOnly firmada con HMAC (ADMIN_SECRET).
 * Para producción conviene migrar a NextAuth con usuarios/roles reales;
 * la interfaz `isAdminRequest` ya está pensada para ese cambio.
 *
 * Seguridad de la sesión: el token no es estático — incluye el bloque de
 * tiempo actual (ventanas de 12 h). Así, una cookie robada deja de ser
 * aceptada por el servidor a las 24 h como máximo, aunque sobreviva en
 * disco. Rotar ADMIN_SECRET invalida TODAS las sesiones al instante
 * (botón de pánico).
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE = "rv_admin";
const SECRET = process.env.ADMIN_SECRET || "rutaviva-dev-secret";
const PIN = process.env.ADMIN_PIN || "rutaviva2025";

/** Ventana de vida de cada token de sesión (12 horas). */
export const SESSION_WINDOW_MS = 12 * 60 * 60 * 1000;

function sessionBucket(now: number): number {
  return Math.floor(now / SESSION_WINDOW_MS);
}

/** Token de sesión del bloque de tiempo actual (rota solo cada 12 h). */
export function adminToken(now = Date.now()): string {
  const bucket = sessionBucket(now);
  return crypto.createHmac("sha256", SECRET).update(`admin-v1|${bucket}`).digest("hex");
}

/** Comparación en tiempo constante entre dos strings. */
function timingSafeMatches(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
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

/** Verifica la cookie del request contra el token del bloque actual o el
 * anterior (gracia para no cortar sesiones justo en el cambio de ventana). */
export function isAdminRequest(req: NextRequest): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const now = Date.now();
  return (
    timingSafeMatches(token, adminToken(now)) ||
    timingSafeMatches(token, adminToken(now - SESSION_WINDOW_MS))
  );
}

/**
 * Hash pseudonimizado de la IP del request (HMAC con sal del servidor,
 * truncado e irreversible) para el registro de seguridad del login.
 * Nunca se guarda ni se transmite la IP en claro.
 */
export function ipHashOf(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "desconocida";
  return crypto.createHmac("sha256", SECRET).update(`ip|${ip}`).digest("hex").slice(0, 32);
}

/** Respuesta 401 estándar para endpoints de admin. */
export function unauthorized() {
  return Response.json({ error: "No autorizado. Inicia sesión como administrador." }, { status: 401 });
}
