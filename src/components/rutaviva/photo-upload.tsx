"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { fileToDataUrl } from "@/lib/image-client";
import { cn } from "@/lib/utils";

type PhotoUploadProps = {
  photos: string[];
  onChange: (photos: string[]) => void;
  max: number;
  label?: string;
};

/**
 * Subida de fotos reutilizable: miniaturas con quitar + botón para añadir
 * (cámara en móvil). Comprime con fileToDataUrl antes de emitir el cambio.
 */
export function PhotoUpload({ photos, onChange, max, label }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = photos.length >= max;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError(null);
    setConverting(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      if (photos.length >= max) {
        setError(`Máximo ${max} ${max === 1 ? "foto" : "fotos"}. Quita una para agregar otra.`);
      } else {
        onChange([...photos, dataUrl]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
    } finally {
      setConverting(false);
    }
  };

  const removeAt = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
    setError(null);
  };

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

        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={converting}
            aria-label="Agregar foto"
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-500 transition hover:border-emerald-400 hover:text-emerald-700",
              converting && "opacity-70"
            )}
          >
            {converting ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-5 w-5" aria-hidden />
            )}
            <span className="text-[11px] font-semibold">
              {converting ? "Procesando…" : "Agregar"}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
