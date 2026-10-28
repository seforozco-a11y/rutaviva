"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/image-client";
import { cn } from "@/lib/utils";

type PhotoUploadProps = {
  photos: string[];
  onChange: (photos: string[]) => void;
  max: number;
  label?: string;
};

/**
 * Subida de fotos reutilizable con DOS fuentes explícitas:
 *  - "Cámara" → input con capture="environment" (en la APK/WebView abre la
 *    cámara directamente; sin este atributo el WebView de Capacitor solo
 *    ofrece archivos y la cámara desaparece).
 *  - "Galería" → input sin capture (en Android ofrece Archivos/Imágenes; en
 *    navegador también permite elegir cámara).
 * Comprime con fileToDataUrl antes de emitir el cambio.
 */
export function PhotoUpload({ photos, onChange, max, label }: PhotoUploadProps) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = photos.length >= max;

  const handleFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (camRef.current) camRef.current.value = "";
    if (galRef.current) galRef.current.value = "";
    if (list.length === 0) return;
    setError(null);
    setConverting(true);
    try {
      const added: string[] = [];
      let skipped = false;
      for (const file of list) {
        if (photos.length + added.length >= max) {
          skipped = true;
          break;
        }
        added.push(await fileToDataUrl(file));
      }
      if (added.length > 0) onChange([...photos, ...added]);
      if (skipped) {
        setError(`Máximo ${max} ${max === 1 ? "foto" : "fotos"}. Se agregaron las primeras.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
      if (photos.length > 0) onChange(photos);
    } finally {
      setConverting(false);
    }
  };

  const removeAt = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
    setError(null);
  };

  const btnClass = cn(
    "flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-sm font-semibold text-stone-600 transition hover:border-emerald-400 hover:bg-emerald-50/40 hover:text-emerald-700 active:scale-[0.98]",
    converting && "pointer-events-none opacity-60"
  );

  return (
    <div className="space-y-1.5">
      {label && (
        <span id={labelId(label)} className="block text-sm font-medium text-stone-700">
          {label}{" "}
          <span className="text-xs font-normal text-stone-400" aria-live="polite">
            {photos.length}/{max}
          </span>
        </span>
      )}

      <div
        role="group"
        aria-label={label ?? "Fotos"}
        aria-describedby={label ? labelId(label) : undefined}
        className="grid grid-cols-3 gap-2"
      >
        {photos.map((url, i) => (
          <div
            key={`${i}-${url.slice(-24)}`}
            className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
          >
            <img
              src={url}
              alt={`Foto ${i + 1} de ${(label ?? "fotos").toLowerCase()}`}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Quitar foto ${i + 1}`}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/70 text-white shadow transition hover:bg-stone-900"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>

      {!full && (
        // Fila de fuentes: cámara y galería con acceso directo de un toque.
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            disabled={converting}
            aria-label="Tomar foto con la cámara"
            className={btnClass}
          >
            {converting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
            {converting ? "Procesando…" : "Cámara"}
          </button>
          <button
            type="button"
            onClick={() => galRef.current?.click()}
            disabled={converting}
            aria-label="Elegir de la galería"
            className={btnClass}
          >
            {converting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden />
            )}
            {converting ? "Procesando…" : "Galería"}
          </button>
        </div>
      )}

      {/* Cámara: captura directa en WebView/navegador móvil. */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {/* Galería: sin capture; permite selección múltiple hasta llenar el máximo. */}
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function labelId(label: string): string {
  return `pu-label-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
}
