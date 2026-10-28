"use client";

import { useState } from "react";
import { CheckCircle2, Crosshair, Loader2, Sparkles } from "lucide-react";
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
import { PhotoUpload } from "./photo-upload";
import { SINGULAR_CATEGORIES } from "@/lib/geo";
import type { Coordinates } from "@/lib/place-types";

type AddPlaceFormProps = {
  origin: Coordinates | null;
  /** Se ejecuta cuando la sugerencia se envió con éxito (para el toast del orquestador). */
  onSuggested: () => void;
  /** "Volver al mapa" desde la pantalla de éxito. */
  onDone: () => void;
};

const EMPTY = {
  name: "",
  category: "monumento",
  description: "",
  address: "",
  lat: "",
  lng: "",
  tips: "",
  suggestedBy: "",
  photos: [] as string[],
};

/**
 * Formulario "Sugerir un lugar" → POST /api/places (queda PENDING).
 * Nada se publica sin la validación del equipo RutaViva: la sugerencia entra
 * a la cola del panel de administración.
 */
export function AddPlaceForm({ origin, onSuggested, onDone }: AddPlaceFormProps) {
  const [values, setValues] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const patch = (p: Partial<typeof EMPTY>) => setValues((v) => ({ ...v, ...p }));

  const useMyLocation = () => {
    if (!origin) return;
    patch({ lat: origin.lat.toFixed(6), lng: origin.lng.toFixed(6) });
  };

  const reset = () => {
    setValues({ ...EMPTY });
    setError(null);
    setSent(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nLat = Number(values.lat.replace(",", "."));
    const nLng = Number(values.lng.replace(",", "."));
    if (values.name.trim().length < 3)
      return setError("El nombre debe tener al menos 3 caracteres.");
    if (values.description.trim().length < 10)
      return setError("Cuenta un poco más: la descripción debe tener al menos 10 caracteres.");
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng))
      return setError("Captura una latitud y longitud válidas (o usa tu ubicación).");

    setSaving(true);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim(),
          category: values.category,
          lat: nLat,
          lng: nLng,
          address: values.address.trim() || null,
          imageUrl: values.photos[0] ?? null,
          photos: values.photos,
          tips: values.tips.trim() || null,
          suggestedBy: values.suggestedBy.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo enviar la sugerencia");
      setSent(true);
      onSuggested();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-10">
        <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
          <h1 className="mt-3 text-2xl font-black tracking-tight text-stone-800">
            ¡Sugerencia enviada!
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            El equipo RutaViva la revisará; si la aprueba aparecerá en el mapa para todos.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              type="button"
              onClick={reset}
              className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Sugerir otro
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDone}
              className="h-11 w-full rounded-xl border-emerald-300 font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Volver al mapa
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-stone-800">
          <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
          Sugerir un lugar singular
        </h1>
        <p className="text-sm text-stone-500">
          ¿Conoces una joya de Manzanillo? Cuéntanosla: nuestro equipo la revisa y, si cumple
          los lineamientos, la publica en la app.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="rv-name">Nombre del lugar *</Label>
        <Input
          id="rv-name"
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Ej. Puestos de tacos del malecón"
          className="h-11 rounded-xl"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-category">Categoría *</Label>
        <Select value={values.category} onValueChange={(v) => patch({ category: v })}>
          <SelectTrigger id="rv-category" className="h-11 rounded-xl">
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
        <Label htmlFor="rv-description">Descripción *</Label>
        <Textarea
          id="rv-description"
          value={values.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="¿Qué lo hace especial? ¿Qué no debe perderse quien lo visite?"
          className="min-h-24 rounded-xl"
          maxLength={2000}
          required
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Coordenadas *</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={useMyLocation}
            disabled={!origin}
            className="h-8 gap-1.5 border-emerald-300 text-xs text-emerald-800 hover:bg-emerald-50"
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden />
            Usar mi ubicación
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="rv-lat" className="text-xs text-stone-500">
              Latitud
            </Label>
            <Input
              id="rv-lat"
              inputMode="decimal"
              value={values.lat}
              onChange={(e) => patch({ lat: e.target.value })}
              placeholder="19.053600"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rv-lng" className="text-xs text-stone-500">
              Longitud
            </Label>
            <Input
              id="rv-lng"
              inputMode="decimal"
              value={values.lng}
              onChange={(e) => patch({ lng: e.target.value })}
              placeholder="-104.314900"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-address">Dirección (opcional)</Label>
        <Input
          id="rv-address"
          value={values.address}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="Calle, número, colonia"
          className="h-11 rounded-xl"
        />
      </div>

      <PhotoUpload
        photos={values.photos}
        onChange={(photos) => patch({ photos })}
        max={5}
        label="Fotos del lugar (opcional)"
      />

      <div className="space-y-1.5">
        <Label htmlFor="rv-tips">Tip local (opcional)</Label>
        <Input
          id="rv-tips"
          value={values.tips}
          onChange={(e) => patch({ tips: e.target.value })}
          placeholder="Ej. Ve al atardecer entre semana"
          className="h-11 rounded-xl"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-suggested-by">Tu nombre (para el crédito)</Label>
        <Input
          id="rv-suggested-by"
          value={values.suggestedBy}
          onChange={(e) => patch({ suggestedBy: e.target.value })}
          placeholder="Ej. María del Carmen"
          className="h-11 rounded-xl"
          maxLength={40}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="h-13 w-full gap-2 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 py-3.5 text-base font-bold shadow-lg shadow-emerald-900/20 hover:from-emerald-800 hover:to-emerald-700"
      >
        {saving ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Enviar a revisión"
        )}
      </Button>
    </form>
  );
}
