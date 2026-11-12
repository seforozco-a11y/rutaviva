import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineKm, SINGULAR_CATEGORIES } from "@/lib/geo";
import { validatePlaceInput } from "@/lib/server/moderation";
import { placeCoverUrl } from "@/lib/image-urls";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export type PlaceRating = { ratingAvg: number | null; ratingCount: number };

type PlaceDTO = {
  id: string;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
  tips: string | null;
  featured: boolean;
  distanceKm: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
};

/**
 * Caché en memoria del catálogo público (Task 40): el query a la DB NO depende
 * de lat/lng/categoría — la distancia y el orden se calculan en memoria por
 * petición. Así cada instancia de función lee la DB como máximo 1 vez por
 * minuto sin importar cuántos usuarios estén explorando. Crítica para el plan
 * gratis de Neon (5 GB de transferencia/mes): el agotamiento de ese límite
 * dejó la app vacía el 7-8 nov 2026.
 */
const PLACES_CACHE_TTL = 60_000;
let placesCache: { ts: number; rows: PlaceDTO[] } | null = null;

async function loadCatalogBase(): Promise<PlaceDTO[]> {
  if (placesCache && Date.now() - placesCache.ts < PLACES_CACHE_TTL) {
    return placesCache.rows;
  }
  /**
   * SIN imageUrl: las portadas base64 pesan hasta 150 KB por fila y la lista
   * no las necesita — la URL ligera se construye con coverInline + updatedAt.
   * Esta consulta es la que más se repite en toda la app: cada byte cuenta
   * para la cuota de transferencia de Neon.
   */
  const rows = await db.singularPlace.findMany({
    where: { active: true, status: "APPROVED" },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      lat: true,
      lng: true,
      address: true,
      tips: true,
      featured: true,
      coverInline: true,
      updatedAt: true,
      createdAt: true,
      reviews: {
        // Igual que en el detalle: las reseñas reportadas (flagged) no
        // cuentan para el rating público mientras el equipo las revisa.
        where: { status: "APPROVED", flagged: false },
        select: { rating: true },
      },
    } satisfies Prisma.SingularPlaceSelect,
  });

  // Segunda lectura SOLO para las portadas no inline (rutas estáticas o https,
  // ≤ 2000 caracteres): barata y necesaria para exponerlas tal cual.
  const nonInlineIds = rows.filter((r) => !r.coverInline).map((r) => r.id);
  const staticUrls = new Map<string, string>();
  if (nonInlineIds.length > 0) {
    const raws = await db.singularPlace.findMany({
      where: { id: { in: nonInlineIds } },
      select: { id: true, imageUrl: true },
    });
    for (const r of raws) if (r.imageUrl) staticUrls.set(r.id, r.imageUrl);
  }

  const mapped = rows.map((r) => {
    const ratings = r.reviews.map((rv) => rv.rating);
    const ratingCount = ratings.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratingCount) * 10) / 10
        : null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category,
      categoryLabel:
        SINGULAR_CATEGORIES.find((c) => c.id === r.category)?.label ?? "Lugar singular",
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      // Inline → ruta de la API de imágenes (base64 nunca viaja al cliente);
      // estática/https → su propia URL.
      imageUrl: placeCoverUrl(r.id, staticUrls.get(r.id) ?? null, r.coverInline, r.updatedAt),
      tips: r.tips,
      featured: r.featured,
      distanceKm: null,
      ratingAvg,
      ratingCount,
      createdAt: r.createdAt.toISOString(),
    };
  });
  placesCache = { ts: Date.now(), rows: mapped };
  return mapped;
}

/**
 * GET /api/places
 *   ?lat=&lng=&radiusKm=&category=  → lugares APPROVED ordenados por cercanía
 *   Sin lat/lng → devuelve todos los publicados (ordenados por destacados)
 * Solo lugares con status APPROVED y active: los PENDING/REJECTED nunca
 * llegan al público hasta que el equipo RutaViva los valida.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const latParam = sp.get("lat");
    const lngParam = sp.get("lng");
    const lat = latParam ? Number(latParam) : NaN;
    const lng = lngParam ? Number(lngParam) : NaN;
    const radiusKm = Math.min(Number(sp.get("radiusKm")) || 50, 300);
    const category = sp.get("category");

    const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);

    // Catálogo base cacheado (máx 1 lectura de DB por minuto por instancia).
    const base = await loadCatalogBase();
    const byCategory =
      category && category !== "all" ? base.filter((p) => p.category === category) : base;

    const mapped: PlaceDTO[] = hasOrigin
      ? byCategory.map((p) => ({
          ...p,
          distanceKm: haversineKm({ lat, lng }, { lat: p.lat, lng: p.lng }),
        }))
      : byCategory;

    const filtered = hasOrigin
      ? mapped.filter((p) => (p.distanceKm ?? 0) <= radiusKm)
      : mapped;

    const sorted = hasOrigin
      ? [...filtered].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      : filtered;

    // Caché de borde además de la memoria local: Vercel re-sirve la respuesta
    // desde el CDN por 60 s (por región) sin invocar la función.
    const res = NextResponse.json({ places: sorted, total: sorted.length });
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res;
  } catch (err) {
    console.error("[api/places GET]", err);
    return NextResponse.json({ error: "No se pudieron cargar los lugares" }, { status: 500 });
  }
}

/**
 * POST /api/places → SUGERENCIA de lugar por parte de un usuario.
 * El lugar NO se publica: queda en status PENDING y pasa a la cola del panel
 * de administración, donde el equipo RutaViva lo revisa ("previa estudio se
 * dará la validación") antes de aparecer en la app.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = validatePlaceInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const suggestedByRaw =
      typeof (body as Record<string, unknown>)?.suggestedBy === "string"
        ? String((body as Record<string, unknown>).suggestedBy).trim()
        : "";
    const suggestedBy = suggestedByRaw ? suggestedByRaw.slice(0, 40) : null;

    const { photos, ...placeData } = parsed.data;
    const coverInline =
      !!placeData.imageUrl && placeData.imageUrl.startsWith("data:");

    const created = await db.singularPlace.create({
      data: {
        ...placeData,
        coverInline,
        status: "PENDING",
        source: "USER",
        suggestedBy,
        // Galería completa: cada foto entra con status PENDING y se aprueba
        // junto con el lugar desde el panel de administración.
        ...(photos.length > 0
          ? {
              photos: {
                create: photos.map((url) => ({
                  url,
                  status: "PENDING",
                  inline: url.startsWith("data:"),
                })),
              },
            }
          : {}),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        placeId: created.id,
        message:
          "¡Gracias por tu aporte! El lugar entró a revisión y, si cumple los lineamientos, se publicará en la app.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/places POST]", err);
    return NextResponse.json({ error: "No se pudo enviar la sugerencia" }, { status: 500 });
  }
}
