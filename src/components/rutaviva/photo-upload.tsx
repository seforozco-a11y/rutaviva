"use client";

import { useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Crop,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fileToDataUrl } from "@/lib/image-client";
import { cn } from "@/lib/utils";
import { PhotoLightbox } from "@/components/rutaviva/photo-lightbox";
import { PhotoCropDialog } from "@/components/rutaviva/photo-crop-dialog";

/** Una foto del formulario: url + bandera de "baúl" (apartada, no borrada). */
export type FormPhoto = {
  url: string;
  /** true = en el baúl: se conserva pero no se publica; un toque la restaura. */
  archived?: boolean;
};

/** URLs de las fotos ACTIVAS (las del baúl se excluyen). */
export function activePhotoUrls(photos: FormPhoto[]): string[] {
  return photos.filter((p) => !p.archived).map((p) => p.url);
}

/** URL de la primera foto activa (la portada del lugar); null si no hay. */
export function firstActivePhotoUrl(photos: FormPhoto[]): string | null {
  return photos.find((p) => !p.archived)?.url ?? null;
}

/**
 * Limita las fotos ACTIVAS a `max` conservando el orden; las fotos del baúl
 * SIEMPRE se conservan (el baúl nunca borra ni deja de viajar al guardado).
 */
export function capActivePhotos(photos: FormPhoto[], max: number): FormPhoto[] {
  let actives = 0;
  return photos.filter((p) => {
    if (p.archived) return true;
    actives += 1;
    return actives <= max;
  });
}

type PhotoUploadProps = {
  photos: FormPhoto[];
  onChange: (photos: FormPhoto[]) => void;
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
 *
 * Cada miniatura también permite:
 *  - Verla en grande (visor PhotoLightbox con pantalla completa, compatible
 *    con el botón atrás del móvil).
 *  - Recortarla libremente (largo y/o ancho) con el ícono de recorte: abre un
 *    editor con asas arrastrables y al aplicar reemplaza la foto comprimida
 *    con el mismo estándar de subida.
 *  - Reordenarla con flechas ◀ ▶ (la primera posición ACTIVA es la portada de
 *    la ficha; con menos de 2 fotos los controles no aparecen y las flechas
 *    saltan por encima de las fotos del baúl).
 *  - Apartarla en el BAÚL con la ✕: nada se borra — la foto queda atenuada
 *    con la leyenda "Baúl", no se muestra al público y un toque sobre ella la
 *    reincorpora a la galería en su lugar original.
 *  - Eliminarla DEFINITIVAMENTE desde el baúl con el ícono de basura (con
 *    confirmación): la foto sale del arreglo y, al guardar, el backend la
 *    borra de la base de datos. Acción irreversible.
 */
export function PhotoUpload({ photos, onChange, max, label }: PhotoUploadProps) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Índice de la foto ampliada en el visor (null = visor cerrado). */
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  /** Índice de la foto en el editor de recorte (null = cerrado). */
  const [cropIdx, setCropIdx] = useState<number | null>(null);
  /** Índice de la foto del baúl con borrado definitivo en confirmación. */
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const activeCount = photos.filter((p) => !p.archived).length;
  const full = activeCount >= max;
  const reorderable = photos.length > 1;
  const firstActiveIdx = photos.findIndex((p) => !p.archived);

  const handleFiles = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (camRef.current) camRef.current.value = "";
    if (galRef.current) galRef.current.value = "";
    if (list.length === 0) return;
    setError(null);
    setConverting(true);
    try {
      const added: FormPhoto[] = [];
      let skipped = false;
      for (const file of list) {
        // Solo las fotos activas cuentan para el máximo (las del baúl ya
        // están fuera de la galería).
        if (activeCount + added.length >= max) {
          skipped = true;
          break;
        }
        added.push({ url: await fileToDataUrl(file) });
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

  /** ✕ = apartar la foto en el BAÚL: se conserva, se ve atenuada y puede
   *  restaurarse con un toque. Nada se borra nunca desde aquí. */
  const archiveAt = (index: number) => {
    const item = photos[index];
    if (!item || item.archived) return;
    const next = [...photos];
    next[index] = { ...item, archived: true };
    onChange(next);
    setError(null);
  };

  /** Tocar una foto del baúl la reincorpora a la galería en su lugar original. */
  const restoreAt = (index: number) => {
    const item = photos[index];
    if (!item || !item.archived) return;
    if (activeCount >= max) {
      setError(
        `Ya hay ${max} fotos activas: aparta una en el baúl antes de restaurar esta.`
      );
      return;
    }
    const next = [...photos];
    next[index] = { ...item, archived: false };
    onChange(next);
    setError(null);
  };

  /** ELIMINACIÓN DEFINITIVA: la foto sale del arreglo y, al guardar, el
   *  backend borra su fila de la base de datos (las fotos que no viajan en
   *  el arreglo se eliminan). Solo se ofrece para fotos del baúl — la ✕ de
   *  una foto activa SIEMPRE aparta (nada se pierde sin confirmación). */
  const deleteAt = (index: number) => {
    const item = photos[index];
    if (!item || !item.archived) return;
    onChange(photos.filter((_, idx) => idx !== index));
    setDeleteIdx(null);
    setError(null);
  };

  /** Intercambia la foto `index` con la vecina ACTIVA en la dirección dada
   *  (las fotos del baúl no participan en el orden de la galería). */
  const moveAt = (index: number, dir: -1 | 1) => {
    let j = index + dir;
    while (j >= 0 && j < photos.length && photos[j]?.archived) j += dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
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
            {activeCount}/{max}
          </span>
        </span>
      )}

      <div
        role="group"
        aria-label={label ?? "Fotos"}
        aria-describedby={label ? labelId(label) : undefined}
        className="grid grid-cols-3 gap-2"
      >
        {photos.map((item, i) => {
          const active = !item.archived;
          // Posición de esta foto dentro de la galería ACTIVA (la que ve el
          // público); para las del baúl queda como referencia del arreglo.
          const activeRank = photos.slice(0, i).filter((p) => !p.archived).length + 1;
          const hasActiveBefore = photos.slice(0, i).some((p) => !p.archived);
          const hasActiveAfter = photos.slice(i + 1).some((p) => !p.archived);
          return (
            <div
              key={`${i}-${item.url.slice(-24)}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-stone-50",
                active ? "border-stone-200" : "border-dashed border-stone-300"
              )}
            >
              {active ? (
                <>
                  {/* La miniatura completa abre el visor en grande. */}
                  <button
                    type="button"
                    onClick={() => setViewIdx(i)}
                    aria-label={`Ampliar foto ${activeRank} de ${activeCount}`}
                    className="absolute inset-0 block focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <img
                      src={item.url}
                      alt={`Foto ${activeRank} de ${(label ?? "fotos").toLowerCase()}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </button>

                  {reorderable && i === firstActiveIdx && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                      Portada
                    </span>
                  )}

                  <div className="absolute right-1 top-1 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCropIdx(i)}
                      aria-label={`Recortar foto ${activeRank}`}
                      title="Recortar esta foto"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/70 text-white shadow transition hover:bg-stone-900"
                    >
                      <Crop className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveAt(i)}
                      aria-label={`Apartar la foto ${activeRank} en el baúl`}
                      title="La apartas al baúl: no se borra y puedes restaurarla con un toque"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/70 text-white shadow transition hover:bg-stone-900"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  {reorderable && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-1 pb-1 pt-4">
                      <button
                        type="button"
                        onClick={() => moveAt(i, -1)}
                        disabled={!hasActiveBefore}
                        aria-label={`Mover foto ${activeRank} una posición antes${
                          !hasActiveBefore ? " (ya es la portada)" : ""
                        }`}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow transition hover:bg-white disabled:opacity-35"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden />
                      </button>
                      <span className="text-[10px] font-bold text-white drop-shadow" aria-hidden>
                        {activeRank}/{activeCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveAt(i, 1)}
                        disabled={!hasActiveAfter}
                        aria-label={`Mover foto ${activeRank} una posición después`}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-stone-800 shadow transition hover:bg-white disabled:opacity-35"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* EN EL BAÚL: atenuada, sin controles de galería; un toque la
                   restaura y el ícono de basura la ELIMINA definitivamente
                   (con confirmación, porque no se puede deshacer). */
                <>
                  <button
                    type="button"
                    onClick={() => restoreAt(i)}
                    aria-label={`Restaurar la foto ${i + 1} del baúl`}
                    title="Toca para devolver esta foto a la galería"
                    className="absolute inset-0 block cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <img
                      src={item.url}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover opacity-40 grayscale"
                      draggable={false}
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-stone-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                        Baúl
                      </span>
                    </span>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent pb-1 pt-4 text-center text-[10px] font-semibold text-white">
                      Toca para restaurar
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteIdx(i)}
                    aria-label={`Eliminar definitivamente la foto ${i + 1} del baúl`}
                    title="Eliminar definitivamente (no se puede deshacer)"
                    className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-700/80 text-white shadow transition hover:bg-red-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </>
              )}
            </div>
          );
        })}
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

      {/* Visor en grande (tarjeta + pantalla completa), con botón atrás del móvil. */}
      <PhotoLightbox
        url={viewIdx !== null ? (photos[viewIdx]?.url ?? null) : null}
        alt={viewIdx !== null ? `Foto ${viewIdx + 1} de ${photos.length}` : "Foto"}
        onClose={() => setViewIdx(null)}
      />

      {/* Editor de recorte libre: al aplicar, reemplaza la foto del formulario.
          Se conserva la bandera del baúl (el recorte no debe cambiar el estado
          de la foto, solo su contenido). */}
      {cropIdx !== null && photos[cropIdx] && (
        <PhotoCropDialog
          key={`${cropIdx}-${photos[cropIdx].url.slice(-24)}`}
          url={photos[cropIdx].url}
          title={`Recortar foto ${(photos.slice(0, cropIdx).filter((p) => !p.archived).length + 1)} de ${activeCount}`}
          onApply={(dataUrl) => {
            const next = [...photos];
            next[cropIdx] = { ...photos[cropIdx], url: dataUrl };
            onChange(next);
            setCropIdx(null);
            setError(null);
          }}
          onClose={() => setCropIdx(null)}
        />
      )}

      {/* Confirmación de borrado definitivo (solo fotos del baúl). */}
      <AlertDialog
        open={deleteIdx !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIdx(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la foto definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              La foto se borrará del baúl y de la base de datos al guardar. Esta
              acción NO se puede deshacer — si solo querías quitarla del
              público, cancela y déjala en el baúl.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteIdx !== null) deleteAt(deleteIdx);
              }}
              className="h-11 rounded-xl bg-red-700 font-bold text-white hover:bg-red-800"
            >
              Sí, eliminarla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function labelId(label: string): string {
  return `pu-label-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`;
}
