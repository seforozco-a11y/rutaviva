"use client";

import { Navigation, MapPin, Lightbulb } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { directionsUrl, formatDistance } from "@/lib/geo";
import type { PlaceDetail } from "@/lib/place-types";

type PlaceDetailSheetProps = {
  detail: PlaceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Bottom-sheet con el detalle de un lugar (singular o común). */
export function PlaceDetailSheet({ detail, open, onOpenChange }: PlaceDetailSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rv-drawer-max">
        {detail && (
          <div className="mx-auto w-full max-w-md pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="pb-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="border-0 hover:opacity-90"
                  style={
                    detail.kind === "common" && detail.color
                      ? { background: `${detail.color}1a`, color: detail.color }
                      : { background: "#d1fae5", color: "#065f46" }
                  }
                >
                  {detail.categoryLabel}
                </Badge>
                {detail.distanceKm != null && (
                  <span className="text-xs font-semibold text-emerald-700">
                    a {formatDistance(detail.distanceKm)}
                  </span>
                )}
              </div>
              <DrawerTitle className="pt-1 text-xl font-black leading-tight text-stone-800">
                {detail.name}
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Detalle del lugar y opciones de navegación
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-3 px-4 pb-2">
              {detail.imageUrl && (
                <img
                  src={detail.imageUrl}
                  alt={`Imagen de ${detail.name}`}
                  className="h-44 w-full rounded-2xl object-cover"
                  loading="lazy"
                />
              )}

              {detail.description && (
                <p className="text-sm leading-relaxed text-stone-600">{detail.description}</p>
              )}

              {detail.tips && (
                <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <span>
                    <strong className="font-semibold">Tip:</strong> {detail.tips}
                  </span>
                </p>
              )}

              {detail.address && (
                <p className="flex items-start gap-2 text-sm text-stone-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                  {detail.address}
                </p>
              )}

              <p className="text-xs text-stone-400">
                {detail.lat.toFixed(5)}, {detail.lng.toFixed(5)}
                {detail.kind === "common" && " · OpenStreetMap"}
              </p>
            </div>

            <DrawerFooter className="flex-row gap-2 pt-2">
              <Button asChild className="h-12 flex-1 gap-2 bg-emerald-700 font-bold hover:bg-emerald-800">
                <a
                  href={directionsUrl({ lat: detail.lat, lng: detail.lng }, detail.name)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="h-4 w-4" aria-hidden />
                  Cómo llegar
                </a>
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1 border-emerald-300 font-semibold text-emerald-800 hover:bg-emerald-50"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
            </DrawerFooter>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
