import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { validatePlaceInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/places/[id] → detalle completo del lugar con TODAS sus fotos
 * de galería (cualquier estado, ordenadas de la más antigua a la más nueva).
 * Lo usa el diálogo "Editar" del panel: la portada (imageUrl) puede vivir
 * fuera de la galería, así que el panel la agrega al frente.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    const place = await db.singularPlace.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { createdAt: "asc" },
          select: { id: true, url: true, status: true, createdAt: true },
        },
      },
    });
    if (!place) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      ...place,
      createdAt: place.createdAt.toISOString(),
      updatedAt: place.updatedAt.toISOString(),
      photos: place.photos.map((ph) => ({
        id: ph.id,
        url: ph.url,
        status: ph.status,
        createdAt: ph.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[api/admin/places/[id] GET]", err);
    return NextResponse.json({ error: "No se pudo cargar el lugar" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/places/[id]
 * action:
 *  - "approve" → publica la sugerencia (status APPROVED); aprueba sus fotos y
 *    si no tiene portada, usa la primera foto recibida (formato mínimo para
 *    publicar: una imagen).
 *  - "reject"  → descarta la sugerencia (status REJECTED).
 *  - "feature" / "unfeature" → destacar o quitar destaque.
 *  - "update"  → edita campos (validados con los mismos formatos de publicación).
 *    Si el cliente envía `photos` (arreglo), TAMBIÉN sincroniza la galería
 *    completa del lugar: quita las fotos eliminadas, agrega las nuevas y deja
 *    photos[0] como portada. Clientes que solo envían imageUrl conservan la
 *    galería intacta (compatibilidad hacia atrás).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const action = String(body?.action ?? "");

    const place = await db.singularPlace.findUnique({
      where: { id },
      include: { photos: { orderBy: { createdAt: "asc" } } },
    });
    if (!place) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }

    if (action === "approve") {
      const firstPending = place.photos.find((p) => p.status === "PENDING");
      await db.photo.updateMany({
        where: { placeId: id, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      await db.singularPlace.update({
        where: { id },
        data: {
          status: "APPROVED",
          active: true,
          ...( !place.imageUrl && firstPending ? { imageUrl: firstPending.url } : {}),
        },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "reject") {
      await db.photo.updateMany({
        where: { placeId: id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await db.singularPlace.update({
        where: { id },
        data: { status: "REJECTED", active: false },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "feature" || action === "unfeature") {
      await db.singularPlace.update({
        where: { id },
        data: { featured: action === "feature" },
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "update") {
      const parsed = validatePlaceInput(body);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const featured =
        typeof body?.featured === "boolean" ? body.featured : place.featured;
      const { photos, ...placeFields } = parsed.data;
      // El panel nuevo siempre envía `photos` (arreglo completo de la galería,
      // photos[0] = portada). Si no viene el arreglo, solo se editan campos y
      // la galería queda intacta (compatibilidad con clientes anteriores).
      const syncGallery = Array.isArray(body?.photos);

      await db.$transaction(async (tx) => {
        await tx.singularPlace.update({
          where: { id },
          data: { ...placeFields, featured },
        });

        if (syncGallery) {
          // Sin duplicados y conservando el orden enviado.
          const nextUrls = [...new Set(photos)];
          const nextSet = new Set(nextUrls);
          const existing = place.photos; // ya viene ordenada por createdAt asc

          // 1) Quitar las fotos que el equipo eliminó en la edición.
          const toDelete = existing.filter((p) => !nextSet.has(p.url));
          if (toDelete.length > 0) {
            await tx.photo.deleteMany({
              where: { id: { in: toDelete.map((p) => p.id) } },
            });
          }

          // 2) Agregar las fotos nuevas. En lugares ya publicados nacen
          //    aprobadas (las sube el equipo tras revisarlas); en sugerencias
          //    PENDING nacen pendientes y "approve" las aprueba al publicar.
          const existingUrls = new Set(existing.map((p) => p.url));
          const toAdd = nextUrls.filter((u) => !existingUrls.has(u));
          if (toAdd.length > 0) {
            await tx.photo.createMany({
              data: toAdd.map((url) => ({
                placeId: id,
                url,
                status: place.status === "APPROVED" ? "APPROVED" : "PENDING",
              })),
            });
          }

          // 3) En un lugar publicado, las fotos pendientes que el equipo
          //    conservó en la edición quedan aprobadas: pasaron la revisión
          //    humana al decidir mantenerlas.
          if (place.status === "APPROVED") {
            await tx.photo.updateMany({
              where: { placeId: id, status: "PENDING" },
              data: { status: "APPROVED" },
            });
          }
        }
      });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/places/[id] PATCH]", err);
    return NextResponse.json({ error: "No se pudo actualizar el lugar" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/places/[id] → eliminación definitiva (cascada de reseñas
 * y fotos). Para "no publicar" sin borrar, usar action "reject".
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    const { id } = await ctx.params;
    await db.singularPlace.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/places/[id] DELETE]", err);
    return NextResponse.json({ error: "No se pudo eliminar el lugar" }, { status: 500 });
  }
}
