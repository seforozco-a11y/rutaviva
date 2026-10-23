"use client";

import { useState } from "react";
import { CheckCircle2, Crosshair, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhotoUpload } from "@/components/rutaviva/photo-upload";
import { SINGULAR_CATEGORIES } from "@/lib/geo";
import type { Coordinates } from "@/lib/place-types";

/** Valores editables del formulario de lugares del panel (todo como texto para los inputs). */
export type PlaceFormValues = {
  name: string;
  description: string;
  category: string;
  lat: string;
  lng: string;
  address: string;
  tips: string;
  city: string;
  state: string;
  photos: string[];
};

export function emptyPlaceValues(): PlaceFormValues {
  return {
    name: "",
    description: "",
    category: "monumento",
    lat: "",
    lng: "",
    address: "",
    tips: "",
    city: "Manzanillo",
    state: "Colima",
    photos: [],
  };
}

export function parseCoords(v: Pick<PlaceFormValues, "lat" | "lng">): {
  lat: number;
  lng: number;
} {
  return {
    lat: Number(v.lat.replace(",", ".")),
    lng: Number(v.lng.replace(",", ".")),
  };
}

/** Checklist "formatos de publicación" calculada en vivo. */
export function placeChecks(v: PlaceFormValues) {
  const { lat, lng } = parseCoords(v);
  return {
    name: v.name.trim().length >= 3,
    description: v.description.trim().length >= 30,
    category: SINGULAR_CATEGORIES.some((c) => c.id === v.category),
    location:
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180,
    photo: v.photos.length > 0,
  };
}

export function checksComplete(checks: ReturnType<typeof placeChecks>): boolean {
  return checks.name && checks.description && checks.category && checks.location && checks.photo;
}

type PlaceFieldsFormProps = {
  idPrefix: string;
  values: PlaceFormValues;
  onPatch: (patch: Partial<PlaceFormValues>) => void;
  /** Ubicación actual del usuario (si existe) para el botón "Usar mi ubicación". */
  origin?: Coordinates | null;
  /** Muestra la lista de formatos de publicación (validación de sugerencias). */
  showChecklist?: boolean;
  /** Muestra los inputs de ciudad/estado (alta directa de lugares). */
  showCityState?: boolean;
};

/**
 * Formulario compartido del equipo RutaViva: campos de un lugar singular con
 * los formatos de publicación. Lo usan el diálogo de validación, la edición
 * y el alta de lugares nuevos.
 */
export function PlaceFieldsForm({
  idPrefix,
  values,
  onPatch,
  origin = null,
  showChecklist = false,
  showCityState = false,
}: PlaceFieldsFormProps) {
  const [geoLoading, setGeoLoading] = useState(false);
  const checks = placeChecks(values);

  const useMyLocation = () => {
    if (origin) {
      onPatch({ lat: origin.lat.toFixed(6), lng: origin.lng.toFixed(6) });
      return;
    }
    if (!("geolocation" in navigator)) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPatch({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  return (
    <div className="space-y-4">
      {showChecklist && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">
            Formatos de publicación
          </p>
          <ul className="mt-2 space-y-1.5">
            <CheckItem ok={checks.name}>Nombre con al menos 3 caracteres</CheckItem>
            <CheckItem ok={checks.description}>
              Descripción con al menos 30 caracteres ({values.description.trim().length})
            </CheckItem>
            <CheckItem ok={checks.category}>Categoría válida</CheckItem>
            <CheckItem ok={checks.location}>Ubicación válida (latitud y longitud)</CheckItem>
            <CheckItem ok={checks.photo}>Al menos una foto</CheckItem>
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Nombre del lugar *</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Ej. Mirador de la bahía"
          className="h-11 rounded-xl"
          maxLength={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Descripción *</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="¿Qué lo hace especial? ¿Qué no debe perderse quien lo visite?"
          className="min-h-24 rounded-xl"
          maxLength={2000}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-category`}>Categoría *</Label>
        <Select value={values.category} onValueChange={(v) => onPatch({ category: v })}>
          <SelectTrigger id={`${idPrefix}-category`} className="h-11 rounded-xl">
            <SelectValue placeholder="Elige una categoría" />
          </SelectTrigger>
          <SelectContent>
            {SINGULAR_CATEGORIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Coordenadas *</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
            disabled={geoLoading}
            className="h-8 gap-1.5 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50"
          >
            {geoLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
            )}
            Usar mi ubicación
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-lat`} className="text-xs text-stone-500">
              Latitud
            </Label>
            <Input
              id={`${idPrefix}-lat`}
              inputMode="decimal"
              value={values.lat}
              onChange={(e) => onPatch({ lat: e.target.value })}
              placeholder="19.053600"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-lng`} className="text-xs text-stone-500">
              Longitud
            </Label>
            <Input
              id={`${idPrefix}-lng`}
              inputMode="decimal"
              value={values.lng}
              onChange={(e) => onPatch({ lng: e.target.value })}
              placeholder="-104.314900"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Dirección (opcional)</Label>
        <Input
          id={`${idPrefix}-address`}
          value={values.address}
          onChange={(e) => onPatch({ address: e.target.value })}
          placeholder="Calle, número, colonia"
          className="h-11 rounded-xl"
        />
      </div>

      <PhotoUpload
        photos={values.photos}
        onChange={(photos) => onPatch({ photos })}
        max={1}
        label="Foto del lugar (portada)"
      />

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-tips`}>Tip local (opcional)</Label>
        <Input
          id={`${idPrefix}-tips`}
          value={values.tips}
          onChange={(e) => onPatch({ tips: e.target.value })}
          placeholder="Ej. Ve al atardecer entre semana"
          className="h-11 rounded-xl"
          maxLength={200}
        />
      </div>

      {showCityState && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-city`} className="text-xs text-stone-500">
              Ciudad
            </Label>
            <Input
              id={`${idPrefix}-city`}
              value={values.city}
              onChange={(e) => onPatch({ city: e.target.value })}
              className="h-10 rounded-xl"
              maxLength={80}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-state`} className="text-xs text-stone-500">
              Estado
            </Label>
            <Input
              id={`${idPrefix}-state`}
              value={values.state}
              onChange={(e) => onPatch({ state: e.target.value })}
              className="h-10 rounded-xl"
              maxLength={80}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CheckItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-stone-300" aria-hidden />
      )}
      <span className={ok ? "font-medium text-stone-700" : "text-stone-500"}>{children}</span>
    </li>
  );
}
