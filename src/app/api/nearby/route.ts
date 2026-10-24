import { NextRequest, NextResponse } from "next/server";
import { haversineKm, commonTypeById } from "@/lib/geo";

export const dynamic = "force-dynamic";

type NearbyPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  distanceKm: number;
};

// Caché en memoria compartida (module scope)
const cache = new Map<string, { ts: number; places: NearbyPlace[] }>();

/**
 * GET /api/nearby?lat=&lng=&type=pharmacy&radius=1500
 * Proxy a Overpass API (OpenStreetMap) → lugares comunes EN VIVO, gratis, sin API key.
 * Caché en memoria de 5 minutos por (tipo, celda de ~200 m) para proteger la API.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const latParam = sp.get("lat");
    const lngParam = sp.get("lng");
    const lat = latParam ? Number(latParam) : NaN;
    const lng = lngParam ? Number(lngParam) : NaN;
    const typeId = sp.get("type") ?? "";
    const radius = Math.min(Math.max(Number(sp.get("radius")) || 1500, 200), 5000);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Coordenadas requeridas" }, { status: 400 });
    }

    const def = commonTypeById(typeId);
    if (!def) {
      return NextResponse.json({ error: "Tipo no soportado" }, { status: 400 });
    }

    // Caché en memoria (celdas de ~200 m)
    const cell = `${typeId}:${lat.toFixed(3)}:${lng.toFixed(3)}:${radius}`;
    const cached = cache.get(cell);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      return NextResponse.json({ places: cached.places, cached: true });
    }

    const selectors = def.osm
      .map(
        (s) =>
          `node${s}(around:${radius},${lat},${lng});way${s}(around:${radius},${lat},${lng});`
      )
      .join("\n");
    const query = `[out:json][timeout:20];\n(\n${selectors}\n);\nout center 60;`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let elements: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }> = [];

    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements?: typeof elements };
      elements = json.elements ?? [];
    } finally {
      clearTimeout(timer);
    }

    const seen = new Set<string>();
    const places: NearbyPlace[] = elements
      .map((e) => {
        const pLat = e.lat ?? e.center?.lat;
        const pLng = e.lon ?? e.center?.lon;
        if (pLat == null || pLng == null) return null;
        return {
          id: `${e.type}/${e.id}`,
          name: e.tags?.name ?? e.tags?.brand ?? e.tags?.operator ?? "Sin nombre",
          lat: pLat,
          lng: pLng,
          type: typeId,
          distanceKm: haversineKm({ lat, lng }, { lat: pLat, lng: pLng }),
        } satisfies NearbyPlace;
      })
      .filter((p): p is NearbyPlace => p !== null)
      .filter((p) => {
        const key = `${p.name}@${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 40);

    cache.set(cell, { ts: Date.now(), places });

    return NextResponse.json({ places, cached: false });
  } catch (err) {
    console.error("[api/nearby GET]", err);
    return NextResponse.json(
      { error: "No se pudieron obtener lugares cercanos. Intenta de nuevo.", places: [] },
      { status: 502 }
    );
  }
}
