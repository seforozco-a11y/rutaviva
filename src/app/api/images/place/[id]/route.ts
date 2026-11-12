import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { serveInlineImage } from "@/lib/server/image-serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/images/place/[id] → portada de un lugar.
 *
 * Sirve las portadas guardadas como data URL base64 convertidas a WebP 720px
 * con caché inmutable de 1 año (el query ?v= con updatedAt las versiona).
 * El público solo recibe lugares APPROVED+active; el equipo autenticado
 * también puede ver portadas de lugares PENDING/REJECTED desde el panel.
 * Si la portada es una URL normal (estática o https), redirige a ella.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const place = await db.singularPlace.findUnique({
      where: { id },
      select: { imageUrl: true, status: true, active: true, updatedAt: true },
    });

    if (!place || !place.imageUrl) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const isPublic = place.status === "APPROVED" && place.active;
    if (!isPublic && !isAdminRequest(req)) {
      // 404 y no 401: no revela la existencia de lugares no publicados.
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    if (!place.imageUrl.startsWith("data:")) {
      return NextResponse.redirect(new URL(place.imageUrl, req.nextUrl.origin), 302);
    }

    return serveInlineImage(place.imageUrl, `place:${id}:${place.updatedAt.getTime()}`);
  } catch (err) {
    console.error("[api/images/place GET]", err);
    return NextResponse.json({ error: "No se pudo cargar la imagen" }, { status: 500 });
  }
}
