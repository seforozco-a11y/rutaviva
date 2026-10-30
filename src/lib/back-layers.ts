/**
 * Pila de capas que se cierran con el botón atrás del móvil.
 *
 * Cada capa apilable (tarjeta de foto, pantalla completa, aviso de
 * privacidad…) se registra aquí al abrirse y se des-registra al cerrarse.
 *
 * - APK (Capacitor): el listener nativo "backButton" (rutaviva-app) consulta
 *   esta pila ANTES de su lógica propia; si hay capas, cierra la superior y
 *   el botón ◀ no cambia de vista ni sale de la app.
 * - Web/PWA: el cierre lo resuelven los popstate de cada capa (ver el hook
 *   useBackClose); esta pila se mantiene en sincronía para ambos caminos.
 */

export type BackLayerId = object;

const layers: Array<{ id: BackLayerId; close: () => void }> = [];

export function pushBackLayer(id: BackLayerId, close: () => void): void {
  layers.push({ id, close });
}

export function removeBackLayer(id: BackLayerId): void {
  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].id === id) {
      layers.splice(i, 1);
      return;
    }
  }
}

/** true si esta capa es la cima de la pila (la única que atiende el atrás). */
export function isTopBackLayer(id: BackLayerId): boolean {
  return layers.length > 0 && layers[layers.length - 1].id === id;
}

/** Cierra la capa superior si la hay. Devuelve true si atendió el botón. */
export function closeTopBackLayer(): boolean {
  const top = layers.pop();
  if (!top) return false;
  top.close();
  return true;
}
