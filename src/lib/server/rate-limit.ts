/**
 * Límite de peticiones en memoria (anti-spam) para los endpoints públicos de
 * escritura: sugerencias de lugar, reseñas y reportes.
 *
 * - La clave es el hash HMAC pseudónimo de la IP (nunca la IP en claro,
 *   coherente con el aviso de privacidad).
 * - El contador vive en la memoria de cada instancia serverless: suficiente
 *   contra spam casual y bots simples (el objetivo es proteger la cola de
 *   moderación y la cuota de Neon, no sustituir un WAF). Con varias
 *   instancias activas el techo efectivo se multiplica — comportamiento
 *   aceptado y documentado.
 * - Limpieza perezosa del Map para que no crezca indefinidamente.
 */

export type RateBucket = { count: number; resetAt: number };

export function rateLimited(
  buckets: Map<string, RateBucket>,
  key: string,
  maxPerWindow: number,
  windowMs: number = 60 * 60 * 1000
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Higiene: si el mapa crece demasiado, expulsa ventanas vencidas.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > maxPerWindow;
}
