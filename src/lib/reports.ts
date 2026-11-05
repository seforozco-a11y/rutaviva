/**
 * Canales de comentarios de RutaViva (compartido cliente/servidor).
 *
 * Dos mecanismos nuevos además del reporte de reseñas:
 *  - PLACE: "¿Información incorrecta?" en la ficha de un lugar — el viajero
 *    avisa de ubicaciones erróneas, lugares cerrados, fotos que no
 *    corresponden, duplicados, etc.
 *  - APP: "Ayuda y comentarios" en el mapa — errores del funcionamiento,
 *    ideas de mejora y quejas sobre contenido publicado.
 *
 * Ambos entran a la cola del panel del equipo (Report → status PENDING) con
 * motivos PREDEFINIDOS para que los reportes lleguen precisos y clasificados,
 * más un detalle libre y un contacto opcional.
 */

export type ReportKind = "PLACE" | "APP";

/** Motivos predefinidos por tipo de reporte (ids estables → BD). */
export const REPORT_REASONS: Record<ReportKind, Array<{ id: string; label: string }>> = {
  PLACE: [
    { id: "ubicacion", label: "La ubicación en el mapa no es correcta" },
    { id: "cerrado", label: "El lugar cerró o ya no existe" },
    { id: "info", label: "La información o las fotos no corresponden" },
    { id: "duplicado", label: "Está repetido en el mapa" },
    { id: "inapropiado", label: "Contenido inapropiado" },
    { id: "otro", label: "Otro motivo" },
  ],
  APP: [
    { id: "error", label: "Algo no funciona (error)" },
    { id: "idea", label: "Una idea o mejora" },
    { id: "contenido", label: "Contenido inapropiado en publicaciones" },
    { id: "otro", label: "Otro motivo" },
  ],
};

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  PLACE: "Reporte de lugar",
  APP: "Comentario sobre la app",
};

/** Etiqueta legible de un motivo; tolera ids desconocidos (datos viejos). */
export function reportReasonLabel(kind: ReportKind, id: string): string {
  return REPORT_REASONS[kind]?.find((r) => r.id === id)?.label ?? id;
}

/** Detalle libre opcional (máx). */
export const MAX_REPORT_DETAIL = 500;
/** Contacto opcional: correo o teléfono (máx). */
export const MAX_REPORT_CONTACT = 80;
/** Meta de dispositivo auto-capturada (máx). */
export const MAX_REPORT_META = 300;

/**
 * Meta de dispositivo/navegador que se adjunta SOLO a comentarios de la app:
 * ayuda a reproducir errores sin pedirle datos al usuario. Es pseudónima
 * (agente de usuario, idioma y tamaño de pantalla) y se trunca.
 */
export function deviceMeta(): string {
  try {
    if (typeof navigator === "undefined") return "";
    const parts = [
      navigator.userAgent ?? "",
      navigator.language ?? "",
      `${window.screen.width}x${window.screen.height} @${window.devicePixelRatio ?? 1}x`,
    ];
    return parts.join(" | ").slice(0, MAX_REPORT_META);
  } catch {
    return "";
  }
}
