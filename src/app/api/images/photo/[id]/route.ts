import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { serveInlineImage } from "@/lib/server/image-serve";

export const dynamic = "force-dynamic";

/**
 * GET /api/images/photo/[id] → una foto (galería de un lugar o de una reseña).
 *
 * Sirve las fotos guardadas como data URL base64 convertidas a WebP 720px con
 * caché inmutable de 1 año (el query ?v= con createdAt las versiona). El
 * público solo recibe fotos APPROVED; el equipo autenticado puede ver también
 * las pendientes/rechazadas desde el panel. Si la foto es una URL normal
 * (estática o https), redirige a ella.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const photo = await db.photo.findUnique({
      where: { id },
      select: { url: true, status: true, createdAt: true },
    });

    if (!photo || !photo.url) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    if (photo.status !== "APPROVED" && !isAdminRequest(req)) {
      // 404 y no 401: no revela la existencia de fotos sin aprobar.
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    if (!photo.url.startsWith("data:")) {
      return NextResponse.redirect(new URL(photo.url, req.nextUrl.origin), 302);
    }

    return serveInlineImage(photo.url, `photo:${id}:${photo.createdAt.getTime()}`);
  } catch (err) {
    console.error("[api/images/photo GET]", err);
    return NextResponse.json({ error: "No se pudo cargar la imagen" }, { status: 500 });
  }
}
