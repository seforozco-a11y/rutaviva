import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineKm, SINGULAR_CATEGORIES } from "@/lib/geo";
import { validatePlaceInput } from "@/lib/server/moderation";

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

    const rows = await db.singularPlace.findMany({
      where: {
        active: true,
        status: "APPROVED",
        ...(category && category !== "all" ? { category } : {}),
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        reviews: {
          // Igual que en el detalle: las reseñas reportadas (flagged) no
          // cuentan para el rating público mientras el equipo las revisa.
          where: { status: "APPROVED", flagged: false },
          select: { rating: true },
        },
      },
    });

    const mapped: PlaceDTO[] = rows.map((r) => {
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
        imageUrl: r.imageUrl,
        tips: r.tips,
        featured: r.featured,
        distanceKm: hasOrigin ? haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng }) : null,
        ratingAvg,
        ratingCount,
        createdAt: r.createdAt.toISOString(),
      };
    });

    const filtered = hasOrigin
      ? mapped.filter((p) => (p.distanceKm ?? 0) <= radiusKm)
      : mapped;

    const sorted = hasOrigin
      ? [...filtered].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      : filtered;

    return NextResponse.json({ places: sorted, total: sorted.length });
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

    const created = await db.singularPlace.create({
      data: {
        ...placeData,
        status: "PENDING",
        source: "USER",
        suggestedBy,
        // Galería completa: cada foto entra con status PENDING y se aprueba
        // junto con el lugar desde el panel de administración.
        ...(photos.length > 0
          ? {
              photos: {
                create: photos.map((url) => ({ url, status: "PENDING" })),
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
