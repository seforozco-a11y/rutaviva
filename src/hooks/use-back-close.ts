"use client";

import { useEffect, useRef } from "react";
import { isTopBackLayer, pushBackLayer, removeBackLayer, type BackLayerId } from "@/lib/back-layers";

/** Un history.back() propio está en vuelo: el popstate que provoque debe
 *  ignorarse (lo consume una sola vez, aunque haya varias capas abiertas). */
let expectingPop = false;

function armExpectingPop() {
  expectingPop = true;
  // Red de seguridad: si popstate no llegara, rearmar la bandera.
  window.setTimeout(() => {
    expectingPop = false;
  }, 400);
}

/**
 * Cierra una capa con el botón atrás del móvil (o el de atrás del navegador).
 *
 * - Web/PWA: al abrir la capa se apila una entrada de historial (pushState);
 *   el popstate del botón atrás ejecuta onClose. Si la capa se cierra desde
 *   la UI (su botón ✕), la entrada se consume con history.back() para dejar
 *   el historial tal como estaba.
 * - APK (Capacitor): la capa se registra en la pila compartida back-layers;
 *   el listener nativo de "backButton" la cierra con closeTopBackLayer(),
 *   sin tocar el historial (el botón atrás nativo no usa goBack).
 *
 * Varias capas simultáneas (tarjeta → pantalla completa → aviso) se
 * des-apilan en orden LIFO, una por pulsación de atrás.
 */
export function useBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  // Mantener la última versión de onClose sin re-crear el listener.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id: BackLayerId = {}; // identidad única de esta capa
    let pushed = false; // entrada de historial propia pendiente de consumir

    pushed = true;
    pushBackLayer(id, () => {
      // Cierre por botón atrás NATIVO (Capacitor): no habrá popstate propio.
      pushed = false;
      onCloseRef.current();
    });
    history.pushState({ rvLayer: true }, "");

    const onPop = () => {
      if (expectingPop) {
        expectingPop = false;
        return;
      }
      if (!pushed) return;
      // Con varias capas abiertas (tarjeta → pantalla completa → aviso),
      // SOLO la cima de la pila responde al botón atrás del navegador.
      if (!isTopBackLayer(id)) return;
      pushed = false;
      removeBackLayer(id);
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      removeBackLayer(id);
      if (pushed) {
        // Cerrada desde la UI (✕ / Escape): consumir su entrada de historial.
        pushed = false;
        armExpectingPop();
        history.back();
      }
    };
  }, [open]);
}

