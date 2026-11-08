import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/admin/backup → RESPALDO COMPLETO de la base de datos como un solo
 * archivo JSON (descarga desde el panel de administración).
 *
 * Diseño pensado para el límite de transferencia de Neon (5 GB/mes) y para los
 * límites de memoria de las funciones serverless:
 *  - STREAMING: el JSON se escribe fila por fila en un ReadableStream; nunca
 *    se carga toda la base en memoria del servidor.
 *  - PAGINACIÓN: cada tabla se lee en lotes de 50 filas (skip/take estable con
 *    orden por createdAt + id), así ni una base con miles de fotos base64
 *    agota la memoria.
 *  - El archivo resultante sirve tanto de copia local del equipo RutaViva como
 *    de insumo para POST /api/admin/restore (reconstruye la base desde cero).
 *
 * Se excluye AdminLoginLog a propósito: es un registro de seguridad efímero
 * (se purga a las 48 h) sin valor de contenido — restaurarlo recrearía
 * "intentos fallidos" fantasma en el panel.
 *
 * Orden de tablas: padres antes que hijos (place → review → photo), para que
 * el archivo sea legible y las FK queden satisfechas en ese mismo orden.
 */

type AnyModel = {
  count: (args?: Record<string, unknown>) => Promise<number>;
  findMany: (args: {
    take: number;
    skip: number;
    orderBy: { createdAt: "asc"; id: "asc" }[];
  }) => Promise<Record<string, unknown>[]>;
};

/** Tablas del respaldo en orden de dependencia (padres primero). */
const TABLES = ["singularPlace", "review", "photo", "report"] as const;
type TableKey = (typeof TABLES)[number];

function model(name: TableKey): AnyModel {
  return (db as unknown as Record<string, AnyModel>)[name];
}

const PAGE = 50;

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  try {
    // Conteos para la cabecera meta (baratos: 4 COUNT).
    const counts: Record<TableKey, number> = {
      singularPlace: await model("singularPlace").count(),
      review: await model("review").count(),
      photo: await model("photo").count(),
      report: await model("report").count(),
    };

    const meta = {
      app: "rutaviva",
      backupVersion: 1 as const,
      createdAt: new Date().toISOString(),
      counts,
      excluded: ["adminLoginLog (registro de seguridad efímero, se purga a las 48 h)"],
    };

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let errored = false;
        const write = (s: string) => {
          if (!errored) controller.enqueue(encoder.encode(s));
        };
        try {
          write(`{"meta":${JSON.stringify(meta)},"tables":{`);
          for (let t = 0; t < TABLES.length; t++) {
            const key = TABLES[t];
            write(`${t > 0 ? "," : ""}${JSON.stringify(key)}:[`);
            let total = 0;
            for (;;) {
              const rows = await model(key).findMany({
                take: PAGE,
                skip: total,
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              });
              for (const row of rows) {
                // Prisma serializa DateTime a ISO por su toJSON; el cliente y
                // el endpoint de restore leen exactamente este formato.
                write(`${total > 0 ? "," : ""}${JSON.stringify(row)}`);
                total++;
              }
              if (rows.length < PAGE) break;
            }
            write("]");
          }
          write("}}");
          controller.close();
        } catch (err) {
          console.error("[api/admin/backup stream]", err);
          if (!errored) {
            errored = true;
            controller.error(err);
          }
        }
      },
    });

    // Nombre de archivo estable: respaldo-rutaviva-20261108-2147.json (UTC)
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp =
      `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
      `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="respaldo-rutaviva-${stamp}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[api/admin/backup GET]", err);
    return Response.json({ error: "No se pudo generar el respaldo" }, { status: 500 });
  }
}
