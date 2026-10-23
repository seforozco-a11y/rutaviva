import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineKm, SINGULAR_CATEGORIES } from "@/lib/geo";

export const dynamic = "force-dynamic";

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
  createdAt: string;
};

/**
 * GET /api/places
 *   ?lat=&lng=&radiusKm=&category=  → lugares singulares ordenados por cercanía
 *   Sin lat/lng → devuelve todos (ordenados por destacados)
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
        ...(category && category !== "all" ? { category } : {}),
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 200,
    });

    const mapped: PlaceDTO[] = rows.map((r) => ({
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
      createdAt: r.createdAt.toISOString(),
    }));

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
 * POST /api/places  → crea un lugar singular (escalabilidad: catálogo infinito)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "otro").trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const address = body.address ? String(body.address).trim() : null;
    const imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    const tips = body.tips ? String(body.tips).trim() : null;

    if (name.length < 3 || name.length > 120) {
      return NextResponse.json({ error: "El nombre debe tener entre 3 y 120 caracteres" }, { status: 400 });
    }
    if (description.length < 10 || description.length > 2000) {
      return NextResponse.json({ error: "La descripción debe tener entre 10 y 2000 caracteres" }, { status: 400 });
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return NextResponse.json({ error: "Latitud inválida" }, { status: 400 });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Longitud inválida" }, { status: 400 });
    }
    if (!SINGULAR_CATEGORIES.some((c) => c.id === category)) {
      return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
    }

    const created = await db.singularPlace.create({
      data: {
        name,
        description,
        category,
        lat,
        lng,
        address,
        imageUrl,
        tips,
      },
    });

    return NextResponse.json({ place: created }, { status: 201 });
  } catch (err) {
    console.error("[api/places POST]", err);
    return NextResponse.json({ error: "No se pudo crear el lugar" }, { status: 500 });
  }
}
