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
 * Pantallas apiladas que el botón atrás del móvil (flecha ◀ de la barra de
 * Android) va deshaciendo en orden — cada nivel apila su propia entrada en
 * el historial (pushState) y el botón atrás dispara popstate, que quita la
 * cima de la pila (LIFO):
 *
 *   pantalla anterior (panel de administrador / hoja de detalle)
 *    └─ 1. Tarjeta: foto ampliada + botón "Pantalla completa"  [rvPhotoCard]
 *        └─ 2. Pantalla completa: foto en todo el viewport     [rvPhotoFs]
 *
 * Al salir por los botones ✕ (en vez del botón atrás) se consume la entrada
 * correspondiente con history.back() para dejar el historial tal como estaba.
 */
export function PhotoLightbox({ url, alt, onClose }: PhotoLightboxProps) {
  /** URL de la foto mostrada a pantalla completa (null = cerrado). */
  const [fsUrl, setFsUrl] = useState<string | null>(null);
  /** Entradas de historial apiladas por este visor, en orden. */
  const stackRef = useRef<Array<"card" | "fs">>([]);
  /** true mientras se espera el popstate de un history.back() propio. */
  const expectingPopRef = useRef(false);

  // Última versión de onClose para el listener de popstate (que es estable).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Botón atrás del móvil / navegador: des-apilar UN nivel del visor.
  useEffect(() => {
    const onPop = () => {
      if (expectingPopRef.current) {
        // popstate provocado por nuestro propio history.back(): ignorarlo.
        expectingPopRef.current = false;
        return;
      }
      const top = stackRef.current.pop();
      if (top === "fs") setFsUrl(null); // fullscreen → tarjeta
      else if (top === "card") onCloseRef.current(); // tarjeta → pantalla anterior
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Nivel 1 (tarjeta): apila su entrada al abrir y la consume al cerrar.
  const cardOpen = url !== null;
  useEffect(() => {
    if (!cardOpen) return;
    stackRef.current.push("card");
    history.pushState({ rvPhotoCard: true }, "");
    return () => {
      if (stackRef.current[stackRef.current.length - 1] === "card") {
        stackRef.current.pop();
        expectingPopRef.current = true;
        // Red de seguridad: si popstate no llegara, rearmar la bandera.
        window.setTimeout(() => {
          expectingPopRef.current = false;
        }, 400);
        history.back();
      }
    };
  }, [cardOpen]);

  // Nivel 2 (pantalla completa): ídem, encima de la tarjeta.
  useEffect(() => {
    if (fsUrl === null) return;
    stackRef.current.push("fs");
    history.pushState({ rvPhotoFs: true }, "");
    return () => {
      if (stackRef.current[stackRef.current.length - 1] === "fs") {
        stackRef.current.pop();
        expectingPopRef.current = true;
        window.setTimeout(() => {
          expectingPopRef.current = false;
        }, 400);
        history.back();
      }
    };
  }, [fsUrl]);

  // Si el visor se desmonta con niveles abiertos, devolver el historial.
  useEffect(
    () => () => {
      const n = stackRef.current.length;
      stackRef.current = [];
      if (n > 0) history.go(-n);
    },
    []
  );

  const openFullscreen = useCallback(() => {
    if (url) setFsUrl(url);
  }, [url]);

  return (
    <>
      {/* Nivel 1: tarjeta con la foto ampliada dentro de la app */}
      <Dialog open={cardOpen} onOpenChange={(o) => !o && onClose()}>
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
          if (!o) setFsUrl(null);
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
            onClick={() => setFsUrl(null)}
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
