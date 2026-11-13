import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { validatePlaceInput } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";

const LIGHT_PHOTO_URL = /^\/api\/images\/photo\/([a-zA-Z0-9]+)/;
const LIGHT_PLACE_URL = /^\/api\/images\/place\/([a-zA-Z0-9]+)/;

/**
 * Resuelve una URL ligera (/api/images/photo/[id] o /api/images/place/[id])
 * a la URL REAL guardada en la fila. Si el cliente envía URLs de la API de
 * imágenes (p. ej. porque salió de una lista optimizada), las fotos existentes
 * no se borran ni se re-crean: se preserva el dato original (base64 o ruta
 * estática).
 */
async function resolvePhotoUrl(u: string): Promise<string> {
  const photoMatch = LIGHT_PHOTO_URL.exec(u);
  if (photoMatch) {
    const row = await db.photo.findUnique({
      where: { id: photoMatch[1] },
      select: { url: true },
    });
    return row?.url ?? u;
  }
  const placeMatch = LIGHT_PLACE_URL.exec(u);
  if (placeMatch) {
    const row = await db.singularPlace.findUnique({
      where: { id: placeMatch[1] },
      select: { imageUrl: true },
    });
    return row?.imageUrl ?? u;
  }
  return u;
}

/**
 * GET /api/admin/places/[id] → detalle completo del lugar con TODAS sus fotos
 * de galería (cualquier estado, incluidas las apartadas en el baúl con
 * archived=true, en el orden elegido por el equipo; si nunca se reordenó, del
 * más antiguo al más nuevo).
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
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { id: true, url: true, status: true, archived: true, createdAt: true },
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
        archived: ph.archived,
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
 *    completa del lugar: quita solo las fotos retiradas del arreglo, agrega
 *    las nuevas, deja la primera foto ACTIVA como portada y guarda el orden
 *    enviado (photos[i] → order i) junto con la bandera del baúl — las fotos
 *    apartadas (archived=true) NO se borran: quedan guardadas para poder
 *    restaurarlas y no aparecen al público.
 *    Clientes que solo envían imageUrl conservan la galería intacta
 *    (compatibilidad hacia atrás).
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
      include: { photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
    });
    if (!place) {
      return NextResponse.json({ error: "Lugar no encontrado" }, { status: 404 });
    }

    if (action === "approve") {
      // Portada de respaldo: la primera foto PENDIENTE que NO esté en el
      // baúl (las apartadas no se publican).
      const firstPending = place.photos.find(
        (p) => p.status === "PENDING" && !p.archived
      );
      await db.photo.updateMany({
        where: { placeId: id, status: "PENDING" },
        data: { status: "APPROVED" },
      });
      await db.singularPlace.update({
        where: { id },
        data: {
          status: "APPROVED",
          active: true,
          ...( !place.imageUrl && firstPending
            ? {
                imageUrl: firstPending.url,
                coverInline: firstPending.url.startsWith("data:"),
              }
            : {}),
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
      // Normaliza URLs ligeras → crudas antes de validar (la validación solo
      // acepta data URLs, /images/ o https). Cada entrada puede ser una URL
      // (string, compatibilidad) o { url, archived } con la bandera del baúl.
      const rawPhotosIn = Array.isArray(body?.photos)
        ? await Promise.all(
            (body.photos as unknown[]).map(async (p) => {
              const rawUrl =
                typeof p === "string"
                  ? String(p)
                  : typeof (p as Record<string, unknown> | null)?.url === "string"
                    ? String((p as Record<string, unknown>).url)
                    : "";
              const archived =
                typeof p === "object" &&
                p !== null &&
                Boolean((p as Record<string, unknown>).archived);
              return { url: await resolvePhotoUrl(rawUrl), archived };
            })
          )
        : undefined;
      const rawImageUrlIn =
        typeof body?.imageUrl === "string" ? await resolvePhotoUrl(body.imageUrl) : body?.imageUrl;
      const normalized = {
        ...(body ?? {}),
        ...(rawPhotosIn !== undefined ? { photos: rawPhotosIn } : {}),
        ...(rawImageUrlIn !== undefined ? { imageUrl: rawImageUrlIn } : {}),
      };
      const parsed = validatePlaceInput(normalized);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const featured =
        typeof body?.featured === "boolean" ? body.featured : place.featured;
      const { photos, ...placeFields } = parsed.data;
      const coverInline =
        !!placeFields.imageUrl && placeFields.imageUrl.startsWith("data:");
      // El panel nuevo siempre envía `photos` (arreglo completo de la galería,
      // photos[0] = portada). Si no viene el arreglo, solo se editan campos y
      // la galería queda intacta (compatibilidad con clientes anteriores).
      const syncGallery = Array.isArray(body?.photos);

      await db.$transaction(async (tx) => {
        await tx.singularPlace.update({
          where: { id },
          data: { ...placeFields, coverInline, featured },
        });

        if (syncGallery) {
          // Sin duplicados y conservando el orden enviado (incluye las fotos
          // del baúl, que viajan con archived=true).
          const nextItems = photos;
          const nextUrls = nextItems.map((p) => p.url);
          const nextSet = new Set(nextUrls);
          const existing = place.photos; // orden elegido (order asc, luego createdAt)

          // 1) Quitar SOLO las fotos que el equipo retiró por completo del
          //    arreglo. Las apartadas en el baúl viajan en el arreglo, así
          //    que nunca llegan aquí: nada se borra por "guardar al baúl".
          const toDelete = existing.filter((p) => !nextSet.has(p.url));
          if (toDelete.length > 0) {
            await tx.photo.deleteMany({
              where: { id: { in: toDelete.map((p) => p.id) } },
            });
          }

          // 2) Agregar las fotos nuevas (con su bandera de baúl si la traen).
          //    En lugares ya publicados nacen aprobadas (las sube el equipo
          //    tras revisarlas); en sugerencias PENDING nacen pendientes y
          //    "approve" las aprueba al publicar. Cada foto nace con su
          //    posición final en la galería.
          const existingUrls = new Set(existing.map((p) => p.url));
          const toAdd = nextItems.filter((p) => !existingUrls.has(p.url));
          if (toAdd.length > 0) {
            await tx.photo.createMany({
              data: toAdd.map((p) => ({
                placeId: id,
                url: p.url,
                status: place.status === "APPROVED" ? "APPROVED" : "PENDING",
                inline: p.url.startsWith("data:"),
                order: nextUrls.indexOf(p.url),
                archived: p.archived,
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

          // 4) Guardar el orden Y el estado de baúl elegidos por el equipo
          //    (la posición i del arreglo enviado = order i). Así el orden y
          //    el baúl sobreviven al guardar y la galería pública los
          //    respeta (filtra archived=true).
          await Promise.all(
            nextItems.map((p, idx) =>
              tx.photo.updateMany({
                where: { placeId: id, url: p.url },
                data: { order: idx, archived: p.archived },
              })
            )
          );
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
