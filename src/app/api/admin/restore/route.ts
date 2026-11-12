import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest, unauthorized } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/restore → RECONSTRUYE la base de datos a partir de un
 * respaldo JSON generado por GET /api/admin/backup.
 *
 * ¿Por qué por fases? Vercel limita el cuerpo de cada petición a 4.5 MB y un
 * respaldo con fotos base64 puede pesar decenas de MB. El panel sube el
 * archivo en fragmentos (~1.5 MB) que se guardan temporalmente en la tabla
 * BackupChunk; al confirmar, se reconstruye el JSON y se aplica en UNA sola
 * transacción (o se restaura todo, o no se toca nada):
 *
 *   1) begin  { sessionId, totalChunks }        → limpia fragmentos viejos
 *   2) chunk  { sessionId, seq, data } (×N)     → guarda cada fragmento
 *   3) commit { sessionId, totalChunks }        → valida + transacción:
 *        borra (photo → review → report → place) y re-inserta (place → review
 *        → photo → report) en orden de dependencia de FK.
 *
 * Seguridad: solo admin (cookie firmada). El archivo se valida contra la
 * firma del respaldo (app=rutaviva, backupVersion=1) antes de tocar datos.
 * Los fragmentos huérfanos se purgan automáticamente (24 h).
 */

const CHUNK_MAX_CHARS = 2_000_000;
const SESSION_MAX_CHARS = 64;
const STALE_MS = 24 * 60 * 60 * 1000;

const TABLES = ["singularPlace", "review", "photo", "report"] as const;
type TableKey = (typeof TABLES)[number];
type TableRows = Record<TableKey, Record<string, unknown>[]>;

type CreateManyModel = {
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
};

/** Inserta en lotes de 100 filas (createMany evita un round-trip por fila). */
async function insertAll(model: CreateManyModel, rows: Record<string, unknown>[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const res = await model.createMany({ data: rows.slice(i, i + 100) });
    n += res.count;
  }
  return n;
}

/** Valida la estructura del respaldo antes de tocar la base. */
function parseBackup(text: string): { ok: true; tables: TableRows } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido (¿descarga incompleta?)" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "El archivo no tiene el formato de un respaldo de RutaViva" };
  }
  const { meta, tables } = parsed as { meta?: unknown; tables?: unknown };
  if (!meta || typeof meta !== "object") {
    return { ok: false, error: "El respaldo no incluye su cabecera (meta)" };
  }
  const m = meta as { app?: unknown; backupVersion?: unknown };
  if (m.app !== "rutaviva" || m.backupVersion !== 1) {
    return { ok: false, error: "Este archivo no es un respaldo de RutaViva compatible (versión distinta)" };
  }
  if (!tables || typeof tables !== "object") {
    return { ok: false, error: "El respaldo no incluye la sección de datos (tables)" };
  }
  const t = tables as Record<string, unknown>;
  const out = {} as TableRows;
  for (const key of TABLES) {
    const rows = t[key];
    if (rows === undefined) {
      return { ok: false, error: `Al respaldo le falta la sección "${key}"` };
    }
    if (!Array.isArray(rows)) {
      return { ok: false, error: `La sección "${key}" del respaldo está dañada` };
    }
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        return { ok: false, error: `Hay una fila inválida en "${key}"` };
      }
    }
    out[key] = rows as Record<string, unknown>[];
  }
  return { ok: true, tables: out };
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();

  // El cuerpo puede ser grande (fragmentos de ~1.5 MB); si no parsea, adiós.
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const phase = typeof body.phase === "string" ? body.phase : "";
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.slice(0, SESSION_MAX_CHARS) : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Falta el identificador de la subida" }, { status: 400 });
  }

  try {
    /* ---------- FASE 1: begin ---------- */
    if (phase === "begin") {
      const totalChunks = Number(body.totalChunks);
      if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 20_000) {
        return NextResponse.json({ error: "Número de fragmentos inválido" }, { status: 400 });
      }
      // Higiene: fragmentos huérfanos (>24 h) y restos de intentos previos
      // con la misma sesión (reintentos) se eliminan.
      await db.backupChunk.deleteMany({
        where: { OR: [{ createdAt: { lt: new Date(Date.now() - STALE_MS) } }, { sessionId }] },
      });
      return NextResponse.json({ ok: true, totalChunks });
    }

    /* ---------- FASE 2: chunk ---------- */
    if (phase === "chunk") {
      const seq = Number(body.seq);
      const data = typeof body.data === "string" ? body.data : "";
      if (!Number.isInteger(seq) || seq < 0) {
        return NextResponse.json({ error: "Índice de fragmento inválido" }, { status: 400 });
      }
      if (data.length === 0) {
        return NextResponse.json({ error: "Fragmento vacío" }, { status: 400 });
      }
      if (data.length > CHUNK_MAX_CHARS) {
        return NextResponse.json({ error: "Fragmento demasiado grande" }, { status: 413 });
      }
      // Upsert: si el mismo fragmento llega dos veces (reintento de red), no
      // rompe la restricción unique(sessionId, seq).
      await db.backupChunk.upsert({
        where: { sessionId_seq: { sessionId, seq } },
        create: { sessionId, seq, data },
        update: { data, createdAt: new Date() },
      });
      return NextResponse.json({ ok: true, seq });
    }

    /* ---------- FASE 3: commit ---------- */
    if (phase === "commit") {
      const declared = Number(body.totalChunks);
      const chunks = await db.backupChunk.findMany({
        where: { sessionId },
        orderBy: { seq: "asc" },
      });
      if (chunks.length === 0) {
        return NextResponse.json(
          { error: "No llegó ningún fragmento para esta restauración" },
          { status: 400 }
        );
      }
      if (Number.isInteger(declared) && chunks.length !== declared) {
        return NextResponse.json(
          { error: `Faltan fragmentos: llegaron ${chunks.length} de ${declared}. Reintenta la restauración.` },
          { status: 400 }
        );
      }

      const text = chunks.map((c) => c.data).join("");
      // Liberamos espacio en la tabla de fragmentos ANTES del trabajo pesado.
      await db.backupChunk.deleteMany({ where: { sessionId } });

      const parsed = parseBackup(text);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { tables } = parsed;

      try {
        // Los flags coverInline/inline se RECOMPUTAN desde el contenido real:
        // respaldos hechos antes del blindaje de transferencia no los traen, y
        // una fila base64 con flag false re-inflaría la lista pública.
        const placeRows = tables.singularPlace.map((row) => ({
          ...row,
          coverInline:
            typeof row.imageUrl === "string" && row.imageUrl.startsWith("data:"),
        }));
        const photoRows = tables.photo.map((row) => ({
          ...row,
          inline: typeof row.url === "string" && row.url.startsWith("data:"),
        }));

        const restored = await db.$transaction(async (tx) => {
          // Borrado en orden inverso de dependencia (hijos primero).
          await tx.photo.deleteMany({});
          await tx.review.deleteMany({});
          await tx.report.deleteMany({});
          await tx.singularPlace.deleteMany({});

          // Inserción en orden de dependencia (padres primero).
          const counts = {
            singularPlace: await insertAll(tx.singularPlace, placeRows),
            review: await insertAll(tx.review, tables.review),
            photo: await insertAll(tx.photo, photoRows),
            report: await insertAll(tx.report, tables.report),
          };
          return counts;
        });

        return NextResponse.json({ ok: true, restored });
      } catch (err) {
        console.error("[api/admin/restore tx]", err);
        return NextResponse.json(
          {
            error:
              "La base sigue intacta: el respaldo contiene filas que no se pudieron insertar (¿referencias rotas o respaldo de otra versión?).",
          },
          { status: 422 }
        );
      }
    }

    return NextResponse.json({ error: "Fase desconocida" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/restore]", err);
    return NextResponse.json({ error: "No se pudo procesar la restauración" }, { status: 500 });
  }
}
