/**
 * Generador del respaldo de RutaViva en formato Excel (.xlsx).
 *
 * Un "listado" legible de TODO el contenido cargado en la base de datos,
 * con las FOTOS INCRUSTADAS en la hoja "Fotos" (compactadas con sharp para
 * que el archivo sea liviano y descargable desde Vercel, cuyo límite de
 * respuesta por petición es 4.5 MB; el respaldo fiel y completo sigue siendo
 * el JSON de la sección "Copia de seguridad").
 *
 * Hojas (en español, mismas convenciones del panel):
 *  - Resumen:  fecha de generación y conteos por estado.
 *  - Lugares:  una fila por lugar, del MÁS RECIENTE al más antiguo
 *              (createdAt DESC, como pidió el equipo).
 *  - Fotos:    una fila por foto (de lugares y de reseñas) con la imagen
 *              incrustada, su posición (Portada/2ª/…/Baúl), estado y fecha.
 *  - Reseñas:  una fila por reseña, agrupada en el mismo orden de Lugares.
 *  - Reportes: reportes y comentarios de usuarios (PLACE y APP).
 */
import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { SINGULAR_CATEGORIES } from "@/lib/geo";
import { REPORT_KIND_LABEL, REPORT_REASONS, type ReportKind } from "@/lib/reports";

/* ---------- Tipos de entrada (compatibles con los resultados de Prisma) ---------- */

export type ExcelPhotoRow = {
  id: string;
  url: string;
  status: string;
  inline: boolean;
  order: number;
  archived: boolean;
  createdAt: Date;
};

export type ExcelReviewRow = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  status: string;
  flagged: boolean;
  flagReason: string | null;
  createdAt: Date;
  photos: ExcelPhotoRow[];
};

export type ExcelPlaceRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  tips: string | null;
  featured: boolean;
  active: boolean;
  status: string;
  source: string;
  suggestedBy: string | null;
  city: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  photos: ExcelPhotoRow[];
  reviews: ExcelReviewRow[];
};

export type ExcelReportRow = {
  id: string;
  kind: string;
  placeName: string | null;
  reason: string;
  detail: string | null;
  contact: string | null;
  status: string;
  createdAt: Date;
};

/* ---------- Etiquetas en español ---------- */

const PLACE_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Publicado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
};

const PHOTO_STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprobada",
  PENDING: "Pendiente",
  REJECTED: "Rechazada",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  RESOLVED: "Resuelto",
  DISMISSED: "Descartado",
};

function categoryLabel(id: string): string {
  return SINGULAR_CATEGORIES.find((c) => c.id === id)?.label ?? "Lugar singular";
}

function reportReasonLabel(kind: string, reason: string): string {
  const list = REPORT_REASONS[kind as ReportKind];
  return list?.find((x) => x.id === reason)?.label ?? reason;
}

function reportKindLabel(kind: string): string {
  return REPORT_KIND_LABEL[kind as ReportKind] ?? kind;
}

function formatLabel(url: string): string {
  const mime = /^data:image\/([a-z0-9+]+)/i.exec(url);
  if (mime) {
    const t = mime[1].toLowerCase();
    if (t === "jpeg" || t === "jpg") return "JPEG";
    if (t === "png") return "PNG";
    if (t === "webp") return "WebP";
    if (t === "gif") return "GIF";
    return t.toUpperCase();
  }
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (!ext || ext.length > 5) return "¿?";
  if (ext === "jpg") return "JPEG";
  return ext.toUpperCase();
}

/** Fecha legible es-MX con zona de RutaViva (Manzanillo = America/Mexico_City). */
function fechaLarga(d: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(d);
}

/** Slug yyyy-mm-dd para el nombre del archivo (zona America/Mexico_City). */
export function excelFilename(d = new Date()): string {
  const slug = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return `respaldo-rutaviva-${slug}.xlsx`;
}

/* ---------- Imágenes: miniatura con sharp ---------- */

type Thumb = {
  data: Buffer;
  displayW: number;
  displayH: number;
  origW: number;
  origH: number;
  bytes: number; // peso ORIGINAL en bytes
};

const MAX_DISPLAY_PX = 420; // tamaño máx. de la imagen dentro de la celda

async function loadThumb(url: string, maxPx: number): Promise<Thumb | null> {
  try {
    let input: Buffer | null = null;
    if (url.startsWith("data:")) {
      input = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
    } else if (url.startsWith("/")) {
      // Ruta estática del repo (/images/...): se lee del public servido.
      const rel = url.split("?")[0].replace(/^\/+/, "");
      input = await fs.readFile(path.join(process.cwd(), "public", rel));
    } else if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return null;
      input = Buffer.from(await res.arrayBuffer());
    } else {
      return null;
    }
    if (!input || input.length === 0) return null;

    // Dimensiones originales desde los metadatos (inputWidth de resize puede
    // faltar según el formato de entrada).
    const meta = await sharp(input).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    const out = await sharp(input)
      .flatten({ background: "#ffffff" }) // PNG con transparencia → fondo blanco
      .resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer({ resolveWithObject: true });

    // Escala de PRESENTACIÓN en la celda (más pequeña que la miniatura).
    const k = Math.min(1, MAX_DISPLAY_PX / out.info.width, MAX_DISPLAY_PX / out.info.height);
    return {
      data: out.data,
      displayW: Math.round(out.info.width * k),
      displayH: Math.round(out.info.height * k),
      origW,
      origH,
      bytes: input.length,
    };
  } catch {
    return null; // imagen ilegible/inexistente → fila con aviso, sin romper
  }
}

/* ---------- Estilos compartidos ---------- */

const HEADER_FILL = {
  type: "pattern" as const,
  pattern: "solid",
  fgColor: { argb: "FF065F46" }, // esmeralda oscuro RutaViva
};
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const BORDER_THIN = {
  top: { style: "thin" as const, color: { argb: "FFD6D3D1" } },
  left: { style: "thin" as const, color: { argb: "FFD6D3D1" } },
  bottom: { style: "thin" as const, color: { argb: "FFD6D3D1" } },
  right: { style: "thin" as const, color: { argb: "FFD6D3D1" } },
};

function styleHeaderRow(ws: ExcelJS.Worksheet, columns: number) {
  const row = ws.getRow(1);
  row.height = 24;
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER_THIN;
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns },
  };
}

/** Bordes + alineación superior para TODA la fila de datos. */
function styleDataRow(row: ExcelJS.Row, columns: number) {
  for (let c = 1; c <= columns; c++) {
    const cell = row.getCell(c);
    cell.border = BORDER_THIN;
    if (cell.alignment?.wrapText !== true) {
      cell.alignment = { vertical: "top" };
    }
  }
}

/** Altura estimada para celdas con wrapText (ancho de columna → líneas). */
function wrappedHeight(text: string, colWidthChars: number): number {
  const perLine = Math.max(10, Math.floor(colWidthChars * 0.95));
  const lines = Math.ceil((text?.length ?? 0) / perLine);
  return Math.min(120, Math.max(15, lines * 13.5 + 4));
}

/* ---------- Construcción del libro ---------- */

export type ExcelBackupCounts = {
  places: number;
  approvedPlaces: number;
  pendingPlaces: number;
  rejectedPlaces: number;
  photos: number;
  galleryPhotos: number;
  baulPhotos: number;
  reviews: number;
  approvedReviews: number;
  reports: number;
};

export type ExcelBackupResult = {
  bytes: Uint8Array;
  filename: string;
  counts: ExcelBackupCounts;
};

export async function buildExcelBackup(
  places: ExcelPlaceRow[],
  reports: ExcelReportRow[],
  opts?: { maxThumbPx?: number; filename?: string }
): Promise<ExcelBackupResult> {
  const maxPx = opts?.maxThumbPx ?? 480;

  /* Filas de fotos: lugares primero (mismo orden de la hoja Lugares) y luego
     las fotos de reseñas de cada lugar. */
  type PhotoEntry = {
    kind: "place" | "review";
    photo: ExcelPhotoRow;
    label: string;
  };
  const photoEntries: PhotoEntry[] = [];
  for (const p of places) {
    for (const ph of p.photos) {
      photoEntries.push({ kind: "place", photo: ph, label: p.name });
    }
    for (const r of p.reviews) {
      for (const ph of r.photos) {
        photoEntries.push({
          kind: "review",
          photo: ph,
          label: `Reseña de ${r.authorName} · ${p.name}`,
        });
      }
    }
  }

  /* Miniaturas en paralelo (una sola vez por foto única). */
  const thumbs = new Map<string, Thumb | null>();
  const unique = Array.from(new Set(photoEntries.map((e) => e.photo.id)));
  await Promise.all(
    unique.map(async (id) => {
      const entry = photoEntries.find((e) => e.photo.id === id);
      if (!entry) return;
      thumbs.set(id, await loadThumb(entry.photo.url, maxPx));
    })
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = "RutaViva";
  wb.created = new Date();
  const now = new Date();

  /* ---------- Hoja: Resumen ---------- */
  const wsS = wb.addWorksheet("Resumen");
  wsS.columns = [
    { key: "c", width: 36 },
    { key: "v", width: 46 },
  ];
  const titleRow = wsS.addRow(["RutaViva · Respaldo en Excel", ""]);
  wsS.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 16, color: { argb: "FF065F46" } };
  titleCell.alignment = { vertical: "middle" };
  titleRow.height = 28;

  const approvedReviews = places.reduce(
    (n, p) => n + p.reviews.filter((r) => r.status === "APPROVED" && !r.flagged).length,
    0
  );
  const totalPhotos = photoEntries.length;
  const galleryPhotos = photoEntries.filter((e) => !e.photo.archived).length;
  const baulPhotos = totalPhotos - galleryPhotos;
  const pendingPlaces = places.filter((p) => p.status === "PENDING").length;
  const rejectedPlaces = places.filter((p) => p.status === "REJECTED").length;
  const approvedPlaces = places.filter((p) => p.status === "APPROVED").length;

  const resumenRows: Array<[string, string | number]> = [
    ["Generado", fechaLarga(now)],
    ["Orden del listado", "Lugares del más RECIENTE al más antiguo (fecha de creación)"],
    ["Lugares (total)", places.length],
    ["· Publicados", approvedPlaces],
    ["· Pendientes de validar", pendingPlaces],
    ["· Rechazados", rejectedPlaces],
    ["Fotos (total)", totalPhotos],
    ["· En galería", galleryPhotos],
    ["· En el baúl (apartadas)", baulPhotos],
    ["Reseñas (total)", places.reduce((n, p) => n + p.reviews.length, 0)],
    ["· Aprobadas y visibles", approvedReviews],
    ["Reportes y comentarios", reports.length],
    [
      "Nota sobre las fotos",
      `Incrustadas compactadas a ${maxPx} px (JPEG). Para el respaldo COMPLETO con archivos originales usa "Descargar respaldo ahora" (JSON) en Copia de seguridad.`,
    ],
  ];
  for (const [k, v] of resumenRows) {
    const r = wsS.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    r.getCell(1).alignment = { vertical: "top" };
    r.getCell(2).alignment = { vertical: "top", wrapText: true };
  }
  wsS.eachRow((row, n) => {
    if (n === 1) return;
    for (let c = 1; c <= 2; c++) row.getCell(c).border = BORDER_THIN;
  });

  /* ---------- Hoja: Lugares (createdAt DESC) ---------- */
  const wsL = wb.addWorksheet("Lugares");
  wsL.columns = [
    { header: "Nº", key: "n", width: 5 },
    { header: "Nombre", key: "name", width: 26 },
    { header: "Categoría", key: "cat", width: 21 },
    { header: "Publicación", key: "pub", width: 12 },
    { header: "¿Destacado?", key: "feat", width: 11 },
    { header: "¿Activo?", key: "act", width: 9 },
    { header: "Origen", key: "orig", width: 10 },
    { header: "Sugerido por", key: "sug", width: 17 },
    { header: "Descripción", key: "desc", width: 52 },
    { header: "Consejos", key: "tips", width: 34 },
    { header: "Dirección", key: "addr", width: 30 },
    { header: "Ciudad", key: "city", width: 13 },
    { header: "Estado", key: "edo", width: 10 },
    { header: "Latitud", key: "lat", width: 12 },
    { header: "Longitud", key: "lng", width: 12 },
    { header: "Rating promedio", key: "rating", width: 13 },
    { header: "Reseñas publicadas", key: "rev", width: 13 },
    { header: "Fotos", key: "fot", width: 8 },
    { header: "En baúl", key: "baul", width: 9 },
    { header: "Creado", key: "cre", width: 17 },
    { header: "Actualizado", key: "upd", width: 17 },
    { header: "ID interno", key: "id", width: 27 },
  ];
  styleHeaderRow(wsL, wsL.columns.length);

  places.forEach((p, i) => {
    const visibles = p.reviews.filter((r) => r.status === "APPROVED" && !r.flagged);
    const avg =
      visibles.length > 0
        ? Math.round((visibles.reduce((a, r) => a + r.rating, 0) / visibles.length) * 10) / 10
        : null;
    const row = wsL.addRow({
      n: i + 1,
      name: p.name,
      cat: categoryLabel(p.category),
      pub: PLACE_STATUS_LABEL[p.status] ?? p.status,
      feat: p.featured ? "Sí" : "No",
      act: p.active ? "Sí" : "No",
      orig: p.source === "USER" ? "Usuario" : "Equipo",
      sug: p.suggestedBy ?? (p.source === "USER" ? "Usuario" : ""),
      desc: p.description,
      tips: p.tips ?? "",
      addr: p.address ?? "",
      city: p.city,
      edo: p.state,
      lat: p.lat,
      lng: p.lng,
      rating: avg,
      rev: visibles.length,
      fot: p.photos.length,
      baul: p.photos.filter((ph) => ph.archived).length,
      cre: p.createdAt,
      upd: p.updatedAt,
      id: p.id,
    });
    row.getCell("lat").numFmt = "0.000000";
    row.getCell("lng").numFmt = "0.000000";
    if (avg !== null) row.getCell("rating").numFmt = "0.0";
    row.getCell("cre").numFmt = "dd/mm/yyyy hh:mm";
    row.getCell("upd").numFmt = "dd/mm/yyyy hh:mm";
    for (const key of ["desc", "tips", "addr"] as const) {
      const cell = row.getCell(key);
      cell.alignment = { vertical: "top", wrapText: true };
    }
    row.height = Math.max(
      wrappedHeight(p.description, 52),
      wrappedHeight(p.tips ?? "", 34),
      15
    );
    styleDataRow(row, wsL.columns.length);
  });

  /* ---------- Hoja: Fotos (con imágenes incrustadas) ---------- */
  const wsF = wb.addWorksheet("Fotos");
  const IMG_COL = 11; // columna K (índice 1-based)
  wsF.columns = [
    { header: "Nº", key: "n", width: 5 },
    { header: "Lugar / reseña", key: "label", width: 28 },
    { header: "Tipo", key: "tipo", width: 9 },
    { header: "Posición", key: "pos", width: 14 },
    { header: "Estado", key: "est", width: 10 },
    { header: "¿En baúl?", key: "baul", width: 10 },
    { header: "Fecha de subida", key: "fe", width: 17 },
    { header: "Formato", key: "fmt", width: 9 },
    { header: "Píxeles originales", key: "px", width: 16 },
    { header: "Peso original (KB)", key: "peso", width: 14 },
    { header: "Imagen", key: "img", width: 60 },
    { header: "ID interno", key: "id", width: 27 },
  ];
  styleHeaderRow(wsF, wsF.columns.length);

  photoEntries.forEach((e, i) => {
    const ph = e.photo;
    // Posición: ranking entre las ACTIVAS del lugar (Portada = 1ª no apartada).
    let pos = "";
    if (e.kind === "place") {
      const owner = places.find((p) => p.photos.includes(ph));
      if (owner) {
        if (ph.archived) pos = "Baúl";
        else {
          const rank = owner.photos.filter((x) => !x.archived).indexOf(ph) + 1;
          pos = rank === 1 ? "Portada (1ª)" : `${rank}ª`;
        }
      } else pos = ph.archived ? "Baúl" : "—";
    } else {
      pos = "Reseña";
    }
    const th = thumbs.get(ph.id) ?? null;
    const row = wsF.addRow({
      n: i + 1,
      label: e.label,
      tipo: e.kind === "place" ? "Lugar" : "Reseña",
      pos,
      est: PHOTO_STATUS_LABEL[ph.status] ?? ph.status,
      baul: ph.archived ? "Sí" : "No",
      fe: ph.createdAt,
      fmt: formatLabel(ph.url),
      px: th ? `${th.origW} × ${th.origH}` : "—",
      peso: th ? Math.round((th.bytes / 1024) * 10) / 10 : null,
      id: ph.id,
    });
    row.getCell("fe").numFmt = "dd/mm/yyyy hh:mm";
    if (th) {
      const imgId = wb.addImage({ buffer: th.data, extension: "jpeg" });
      wsF.addImage(imgId, {
        tl: { col: IMG_COL - 1, row: row.number - 1 },
        ext: { width: th.displayW, height: th.displayH },
        editAs: "oneCell",
      });
      row.height = Math.min(409, th.displayH * 0.75 + 8);
    } else {
      const cell = row.getCell("img");
      cell.value = "(imagen no disponible)";
      cell.font = { italic: true, color: { argb: "FFA8A29E" } };
    }
    row.getCell("label").alignment = { vertical: "top", wrapText: true };
    styleDataRow(row, wsF.columns.length);
  });

  /* ---------- Hoja: Reseñas ---------- */
  const wsR = wb.addWorksheet("Reseñas");
  wsR.columns = [
    { header: "Nº", key: "n", width: 5 },
    { header: "Lugar", key: "place", width: 26 },
    { header: "Autor", key: "autor", width: 18 },
    { header: "Calificación", key: "cal", width: 12 },
    { header: "Comentario", key: "com", width: 62 },
    { header: "Publicación", key: "pub", width: 12 },
    { header: "¿Reportada?", key: "rep", width: 11 },
    { header: "Motivo del reporte", key: "mot", width: 26 },
    { header: "Fotos", key: "fot", width: 7 },
    { header: "Fecha", key: "fe", width: 17 },
    { header: "ID interno", key: "id", width: 27 },
  ];
  styleHeaderRow(wsR, wsR.columns.length);

  let reviewN = 0;
  for (const p of places) {
    for (const r of p.reviews) {
      reviewN += 1;
      const row = wsR.addRow({
        n: reviewN,
        place: p.name,
        autor: r.authorName,
        cal: r.rating,
        com: r.comment,
        pub: PHOTO_STATUS_LABEL[r.status] ?? r.status,
        rep: r.flagged ? "Sí" : "No",
        mot: r.flagged ? (r.flagReason ?? "") : "",
        fot: r.photos.length,
        fe: r.createdAt,
        id: r.id,
      });
      row.getCell("fe").numFmt = "dd/mm/yyyy hh:mm";
      const com = row.getCell("com");
      com.alignment = { vertical: "top", wrapText: true };
      row.height = wrappedHeight(r.comment, 62);
      styleDataRow(row, wsR.columns.length);
    }
  }

  /* ---------- Hoja: Reportes ---------- */
  const wsP = wb.addWorksheet("Reportes");
  wsP.columns = [
    { header: "Nº", key: "n", width: 5 },
    { header: "Tipo", key: "tipo", width: 22 },
    { header: "Lugar", key: "lugar", width: 24 },
    { header: "Motivo", key: "mot", width: 34 },
    { header: "Detalle", key: "det", width: 56 },
    { header: "Contacto", key: "con", width: 22 },
    { header: "Estado", key: "est", width: 11 },
    { header: "Fecha", key: "fe", width: 17 },
    { header: "ID interno", key: "id", width: 27 },
  ];
  styleHeaderRow(wsP, wsP.columns.length);

  reports.forEach((rep, i) => {
    const row = wsP.addRow({
      n: i + 1,
      tipo: reportKindLabel(rep.kind),
      lugar: rep.placeName ?? "",
      mot: reportReasonLabel(rep.kind, rep.reason),
      det: rep.detail ?? "",
      con: rep.contact ?? "",
      est: REPORT_STATUS_LABEL[rep.status] ?? rep.status,
      fe: rep.createdAt,
      id: rep.id,
    });
    row.getCell("fe").numFmt = "dd/mm/yyyy hh:mm";
    const det = row.getCell("det");
    det.alignment = { vertical: "top", wrapText: true };
    row.height = wrappedHeight(rep.detail ?? "", 56);
    styleDataRow(row, wsP.columns.length);
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const bytes = new Uint8Array(arrayBuffer as ArrayBuffer);
  return {
    bytes,
    filename: opts?.filename ?? excelFilename(now),
    counts: {
      places: places.length,
      approvedPlaces,
      pendingPlaces,
      rejectedPlaces,
      photos: totalPhotos,
      galleryPhotos,
      baulPhotos,
      reviews: places.reduce((n, p) => n + p.reviews.length, 0),
      approvedReviews,
      reports: reports.length,
    },
  };
}
