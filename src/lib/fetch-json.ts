/**
 * Envío de formularios con blindaje de red (auditoría 20-nov-2026).
 *
 * Problema que resuelve: los formularios usaban `fetch` pelado — sin
 * límite de tiempo ni mensajes claros. Con red muerta o señal de playa
 * débil, el botón quedaba en "Enviando…" minutos y el usuario recargaba por
 * frustración (perdiendo su texto y fotos).
 *
 * - Timeout: aborta a los 20 s (el cap de body de Vercel y la validación
 *   responden mucho antes; 20 s solo se alcanza con red realmente mala).
 * - Mensaje por código: 413 (fotos demasiado pesadas), 429 (límite anti-spam
 *   alcanzado), 5xx (fallo del servidor) y red caída — cada uno con texto
 *   accionable en claro para el usuario.
 */

export const REQUEST_TIMEOUT_MS = 20_000;

/** Clasifica el error de un POST para dar un mensaje accionable. */
export async function postJson(
  url: string,
  body: unknown,
  opts: { timeoutMs?: number } = {}
): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    // AbortError con nombre "TimeoutError" o AbortError → nuestro límite de
    // tiempo; TypeError Failed to fetch → red caída / DNS / CORS.
    if (err instanceof DOMException || (err as Error)?.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        error:
          "La conexión tardó demasiado. Revisa tu señal y vuelve a intentar — no pierdes lo que escribiste.",
      };
    }
    return {
      ok: false,
      status: 0,
      error:
        "Sin conexión con RutaViva. Revisa tu internet o datos móviles y vuelve a intentar — no pierdes lo que escribiste.",
    };
  }
  clearTimeout(timer);

  const json = (await res.json().catch(() => null)) as { error?: string } | null;

  if (res.ok) return { ok: true, status: res.status };

  if (res.status === 413) {
    return {
      ok: false,
      status: res.status,
      error:
        "Las fotos son demasiado pesadas para enviarlas juntas. Quita alguna o elige imágenes más ligeras e intenta de nuevo.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      status: res.status,
      error: json?.error ?? "Hiciste demasiados envíos seguidos. Espera un rato e intenta de nuevo.",
    };
  }
  return {
    ok: false,
    status: res.status,
    error: json?.error ?? "No se pudo enviar. Espera unos segundos y vuelve a intentar — no pierdes lo que escribiste.",
  };
}
