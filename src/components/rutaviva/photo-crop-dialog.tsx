"use client";

import { useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Crop as CropIcon, Loader2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackClose } from "@/hooks/use-back-close";
import { cropPhotoToDataUrl, type CropArea } from "@/lib/image-client";

type PhotoCropDialogProps = {
  /** URL cruda de la foto a recortar (data:, /images/… o /api/images/…). */
  url: string;
  /** Título con contexto, p. ej. "Recortar foto 2 de 5". */
  title: string;
  /** Recibe la foto recortada como data URL comprimida (mismo estándar de subida). */
  onApply: (dataUrl: string) => void;
  onClose: () => void;
};

/** Selección inicial: toda la foto (porcentajes, independiente del tamaño). */
const FULL_CROP: PercentCrop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

/**
 * Recortador de fotos del panel RutaViva: selección LIBRE (se arrastran los
 * bordes y esquinas; en pantalla táctil la librería muestra asas grandes solo
 * en las esquinas). Sin proporción fija — el equipo decide el largo y el ancho.
 * Al aplicar, el recorte se comprime con el mismo estándar de subida
 * (JPEG, máx 960 px, calidad 0.66) y reemplaza a la foto en el formulario.
 * Compatible con el botón atrás del móvil (capa apilable vía useBackClose).
 */
export function PhotoCropDialog({ url, title, onApply, onClose }: PhotoCropDialogProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackClose(true, onClose);

  const onImgLoad = () => {
    const img = imgRef.current;
    if (img && img.naturalWidth && img.naturalHeight) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  const resetToFull = () => {
    setCrop(FULL_CROP);
    setError(null);
  };

  const apply = async () => {
    if (!natural) {
      setError("La imagen aún está cargando. Espera un momento e intenta de nuevo.");
      return;
    }
    // La selección se guarda en PORCENTAJES (independiente del tamaño en
    // pantalla): el área natural es directamente % × dimensiones de origen.
    const area: CropArea = {
      x: (crop.x / 100) * natural.w,
      y: (crop.y / 100) * natural.h,
      width: (crop.width / 100) * natural.w,
      height: (crop.height / 100) * natural.h,
    };
    setBusy(true);
    setError(null);
    try {
      const out = await cropPhotoToDataUrl(url, area);
      onApply(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recortar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-4">
        <DialogTitle className="flex items-center gap-2 text-base font-black text-stone-800">
          <CropIcon className="h-4 w-4 text-emerald-700" aria-hidden />
          {title}
        </DialogTitle>
        <DialogDescription className="text-sm text-stone-500">
          Arrastra las esquinas o los bordes del recuadro para elegir el área que se
          queda. Todo lo de afuera se elimina al aplicar.
        </DialogDescription>

        <div className="flex justify-center rounded-xl bg-stone-900 p-1">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            keepSelection
            minWidth={24}
            minHeight={24}
            ruleOfThirds
            className="max-h-[42dvh]"
            ariaLabels={{
              cropArea: "Área de recorte. Arrástrala para moverla.",
              nwDragHandle: "Esquina superior izquierda del recorte",
              nDragHandle: "Borde superior del recorte",
              neDragHandle: "Esquina superior derecha del recorte",
              eDragHandle: "Borde derecho del recorte",
              seDragHandle: "Esquina inferior derecha del recorte",
              sDragHandle: "Borde inferior del recorte",
              swDragHandle: "Esquina inferior izquierda del recorte",
              wDragHandle: "Borde izquierdo del recorte",
            }}
          >
            <img
              ref={imgRef}
              src={url}
              alt={title}
              onLoad={onImgLoad}
              className="block max-h-[42dvh] w-auto select-none"
              draggable={false}
            />
          </ReactCrop>
        </div>

        <p className="text-center text-xs text-stone-500" aria-live="polite">
          {natural
            ? `Selección: ${Math.round((crop.width / 100) * natural.w)} × ${Math.round(
                (crop.height / 100) * natural.h
              )} px de ${natural.w} × ${natural.h} px`
            : "Cargando imagen…"}
        </p>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={resetToFull}
            disabled={busy}
            aria-label="Usar toda la foto (reiniciar el recorte)"
            title="Usar toda la foto"
            className="h-11 w-11 shrink-0 border-stone-200"
          >
            <Maximize className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="h-11 border-stone-200 font-semibold text-stone-600"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={busy || !natural}
            className="h-11 flex-1 bg-emerald-700 font-bold text-white hover:bg-emerald-800"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? "Aplicando…" : "Aplicar recorte"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
