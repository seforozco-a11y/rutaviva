"use client";

/**
 * Puente de geolocalización de RutaViva.
 *
 * ¿Por qué NO usamos navigator.geolocation directamente dentro de la app
 * Android? El WebView guarda en caché la denegación del usuario: si niega el
 * permiso una vez (o cierra la app con el diálogo abierto), en las aperturas
 * siguientes getCurrentPosition falla en silencio y el diálogo nativo JAMÁS
 * vuelve a mostrarse — la app parece rota y el usuario no sabe por qué.
 *
 * Este módulo usa el plugin nativo @capacitor/geolocation (ya compilado
 * dentro de la APK), que consulta al sistema Android en cada apertura:
 *  - checkPermissions(): lee el estado REAL del permiso (no la caché del WebView).
 *  - requestPermissions(): vuelve a mostrar el diálogo nativo mientras el
 *    estado sea "prompt"; si la denegación es permanente resuelve "denied"
 *    al instante, sin diálogo.
 *  - getCurrentPosition(): posición vía puente nativo, inmune a esa caché.
 *
 * En navegador/PWA (no nativo) degrada a la API estándar del navegador.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { GpsProblem } from "./map-view";

export type LocateResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; problem: GpsProblem };

/** true dentro de la app Android (puente nativo disponible). */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

interface RutaVivaNativePlugin {
  openAppSettings(): Promise<void>;
  openLocationSettings(): Promise<void>;
}

/**
 * Plugin nativo propio (RutaVivaNativePlugin.java). En APKs anteriores a la
 * que lo incluye, las llamadas lanzan "not implemented": los métodos lo
 * capturan y devuelven false para degradar con gracia.
 */
const RutaVivaNative = registerPlugin<RutaVivaNativePlugin>("RutaVivaNative");

/** Abre Ajustes → Aplicaciones → RutaViva → Permisos. false si no se pudo. */
export async function openAppSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RutaVivaNative.openAppSettings();
    return true;
  } catch {
    return false;
  }
}

/** Abre la pantalla del sistema para activar/desactivar la Ubicación (GPS). */
export async function openLocationSettings(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await RutaVivaNative.openLocationSettings();
    return true;
  } catch {
    return false;
  }
}

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 30_000,
} as const;

/**
 * Intenta obtener la posición real del usuario.
 * Nunca lanza: siempre resuelve con coordenadas o con el problema clasificado.
 */
export async function locate(): Promise<LocateResult> {
  if (Capacitor.isNativePlatform()) {
    try {
      // 1) Estado real del permiso (lee el sistema, no la caché del WebView).
      let status = await Geolocation.checkPermissions();
      if (status.location !== "granted") {
        // 2) Pide el permiso: muestra el diálogo nativo cuando el sistema
        //    aún lo permite; si quedó denegado de forma permanente resuelve
        //    "denied" al instante (sin diálogo) y el aviso de la app guía
        //    al usuario hacia Ajustes.
        try {
          status = await Geolocation.requestPermissions();
        } catch {
          /* quedó denegado */
        }
      }
      if (status.location !== "granted") {
        return { ok: false, problem: "denied" };
      }

      // 3) Permiso concedido: posición vía puente nativo.
      try {
        const pos = await Geolocation.getCurrentPosition(GPS_OPTIONS);
        return { ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (e) {
        // Con permiso concedido: servicios de ubicación apagados/sin señal
        // (off) o tiempo agotado esperando la señal (timeout).
        const msg = String(
          (e as { message?: string } | null)?.message ?? ""
        ).toLowerCase();
        const timedOut = msg.includes("timeout") || msg.includes("timed out");
        return { ok: false, problem: timedOut ? "timeout" : "off" };
      }
    } catch {
      return { ok: false, problem: "off" };
    }
  }

  // ---- Navegador / PWA: API estándar ----
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { ok: false, problem: "off" };
  }
  return new Promise<LocateResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) =>
        resolve({
          ok: false,
          problem:
            err?.code === 1 ? "denied" : err?.code === 2 ? "off" : "timeout",
        }),
      GPS_OPTIONS
    );
  });
}

/**
 * Acción del botón «Activar GPS» del aviso: intenta conceder el permiso y,
 * si el sistema ya no muestra el diálogo (denegación permanente), abre
 * directamente los Ajustes de la app. Devuelve true si quedó concedido.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return "geolocation" in navigator;
  try {
    let status = await Geolocation.checkPermissions();
    if (status.location !== "granted") {
      try {
        status = await Geolocation.requestPermissions();
      } catch {
        /* sigue denegado */
      }
    }
    if (status.location === "granted") return true;
    // Denegación permanente: llevarlo de la mano a Ajustes.
    await openAppSettings();
    return false;
  } catch {
    return false;
  }
}
