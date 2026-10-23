"use client";

import { useState } from "react";
import { Crosshair, Loader2, Sparkles } from "lucide-react";
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
import { SINGULAR_CATEGORIES } from "@/lib/geo";
import type { Coordinates, SingularPlaceDTO } from "@/lib/place-types";

type AddPlaceFormProps = {
  origin: Coordinates | null;
  onCreated: (place: SingularPlaceDTO) => void;
};

/**
 * Formulario "Agregar lugar singular" → POST /api/places
 * Así el catálogo crece sin tocar código: la escalabilidad vive en la base de datos.
 */
export function AddPlaceForm({ origin, onCreated }: AddPlaceFormProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("monumento");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [tips, setTips] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = () => {
    if (!origin) return;
    setLat(origin.lat.toFixed(6));
    setLng(origin.lng.toFixed(6));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nLat = Number(lat.replace(",", "."));
    const nLng = Number(lng.replace(",", "."));
    if (name.trim().length < 3) return setError("El nombre debe tener al menos 3 caracteres.");
    if (description.trim().length < 10)
      return setError("Cuenta un poco más: la descripción debe tener al menos 10 caracteres.");
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng))
      return setError("Captura una latitud y longitud válidas (o usa tu ubicación).");

    setSaving(true);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          lat: nLat,
          lng: nLng,
          address: address.trim() || null,
          imageUrl: imageUrl.trim() || null,
          tips: tips.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "No se pudo guardar el lugar");
      onCreated(json.place as SingularPlaceDTO);
      // Limpiar para el siguiente lugar
      setName("");
      setDescription("");
      setAddress("");
      setLat("");
      setLng("");
      setImageUrl("");
      setTips("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-stone-800">
          <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
          Nuevo lugar singular
        </h1>
        <p className="text-sm text-stone-500">
          Suma joyas de tu ciudad: miradores, murales, puestos legendarios… Aparecerán al instante
          en el mapa para todos.
        </p>
      </header>

      <div className="space-y-1.5">
        <Label htmlFor="rv-name">Nombre del lugar *</Label>
        <Input
          id="rv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Mirador de la BUAP"
          className="h-11 rounded-xl"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-category">Categoría *</Label>
        <Select value={category} onValueChange={setCategory}>
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="19.432600"
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
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-99.133200"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-address">Dirección (opcional)</Label>
        <Input
          id="rv-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Calle, número, colonia"
          className="h-11 rounded-xl"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-image">URL de imagen (opcional)</Label>
        <Input
          id="rv-image"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          className="h-11 rounded-xl"
          type="url"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-tips">Tip local (opcional)</Label>
        <Input
          id="rv-tips"
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          placeholder="Ej. Ve al atardecer entre semana"
          className="h-11 rounded-xl"
          maxLength={200}
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
            Guardando…
          </>
        ) : (
          "Publicar lugar singular"
        )}
      </Button>
    </form>
  );
}
