"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type PhotoLightboxProps = {
  url: string | null;
  alt: string;
  onClose: () => void;
};

/**
 * Visor de fotos para reseñas, sugerencias y la galería del lugar.
 *
 * Dos niveles:
 *  1. Tarjeta (Dialog): la foto ampliada dentro de la app, con botón
 *     "Pantalla completa" — también basta con tocar la foto.
 *  2. Pantalla completa (fsUrl): la foto ocupa TODO el viewport sobre fondo
 *     negro, con la descripción abajo y botón de salir.
 *
 * Botón atrás del móvil (flecha ◀ de la barra de Android): al abrir la
 * pantalla completa se apila una entrada propia en el historial (pushState);
 * el botón atrás del WebView dispara popstate y eso cierra el visor,
 * regresando a la tarjeta. Al salir por el botón ✕ se consume esa entrada
 * con history.back() para dejar el historial tal como estaba.
 */
export function PhotoLightbox({ url, alt, onClose }: PhotoLightboxProps) {
  /** URL de la foto mostrada a pantalla completa (null = cerrado). */
  const [fsUrl, setFsUrl] = useState<string | null>(null);
  /** Hay una entrada de historial propia del fullscreen apilada. */
  const pushedRef = useRef(false);
  /** El cierre lo inició history.back() (no volver a consumir la entrada). */
  const closingRef = useRef(false);
  const failsafeRef = useRef(0);

  const openFullscreen = useCallback(() => {
    if (url) setFsUrl(url);
  }, [url]);

  const closeFullscreen = useCallback(() => {
    if (!pushedRef.current) {
      // Sin entrada propia aún (apertura recién programada): cerrar directo.
      setFsUrl(null);
      return;
    }
    closingRef.current = true;
    window.clearTimeout(failsafeRef.current);
    // Red de seguridad: si el entorno no dispara popstate tras history.back(),
    // cerrar de todos modos para nunca dejar al usuario atrapado.
    failsafeRef.current = window.setTimeout(() => {
      if (pushedRef.current) {
        pushedRef.current = false;
        closingRef.current = false;
        setFsUrl(null);
      }
    }, 400);
    history.back();
  }, []);

  // Al abrir la pantalla completa se apila la entrada de historial; el botón
  // atrás del móvil (o del navegador) dispara popstate y la cierra.
  useEffect(() => {
    if (fsUrl === null) return;
    pushedRef.current = true;
    history.pushState({ rvPhotoFs: true }, "");
    const onPop = () => {
      window.clearTimeout(failsafeRef.current);
      pushedRef.current = false;
      closingRef.current = false;
      setFsUrl(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.clearTimeout(failsafeRef.current);
      if (pushedRef.current && !closingRef.current) {
        // Se desmontó sin pasar por closeFullscreen (Escape, la tarjeta se
        // cerró por debajo, etc.): limpiar su entrada del historial.
        closingRef.current = true;
        history.back();
      }
      pushedRef.current = false;
      closingRef.current = false;
    };
  }, [fsUrl]);

  return (
    <>
      {/* Nivel 1: tarjeta con la foto ampliada dentro de la app */}
      <Dialog open={url !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl p-3">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogDescription className="sr-only">{alt}</DialogDescription>
          {url && (
            <>
              <button
                type="button"
                onClick={openFullscreen}
                className="block w-full overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-emerald-600"
                aria-label={`Ocupar toda la pantalla con esta foto. ${alt}`}
              >
                <img
                  src={url}
                  alt={alt}
                  className="max-h-[60dvh] w-full rounded-xl bg-stone-950/90 object-contain"
                  draggable={false}
                />
              </button>
              <button
                type="button"
                onClick={openFullscreen}
                className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 active:bg-emerald-900"
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
                Pantalla completa
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Nivel 2: pantalla completa — se sale con el botón atrás del móvil
          (popstate) o con el botón de salir */}
      <Dialog
        open={fsUrl !== null}
        onOpenChange={(o) => {
          if (!o) closeFullscreen();
        }}
      >
        <DialogContent
          data-photo-fs="true"
          showCloseButton={false}
          className="fixed top-0 left-0 z-[1500] flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 bg-black p-0 sm:max-w-none data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100"
        >
          <DialogTitle className="sr-only">
            {alt} — pantalla completa
          </DialogTitle>
          <DialogDescription className="sr-only">{alt}</DialogDescription>

          {fsUrl && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <img
                src={fsUrl}
                alt={alt}
                className="max-h-full w-auto max-w-full select-none object-contain"
                draggable={false}
              />
            </div>
          )}

          {alt ? (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 text-center text-xs text-white/80">
              {alt}
            </p>
          ) : null}

          <button
            type="button"
            onClick={closeFullscreen}
            aria-label="Salir de pantalla completa"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 active:bg-white/40"
          >
            <Minimize2 className="h-5 w-5" aria-hidden />
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
