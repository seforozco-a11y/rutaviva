"use client";

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

/** Visor de imagen a pantalla completa (lightbox) para fotos de reseñas/sugerencias. */
export function PhotoLightbox({ url, alt, onClose }: PhotoLightboxProps) {
  return (
    <Dialog open={url !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl p-3">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">{alt}</DialogDescription>
        {url && (
          <img
            src={url}
            alt={alt}
            className="max-h-[70dvh] w-full rounded-xl object-contain bg-stone-950/90"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
