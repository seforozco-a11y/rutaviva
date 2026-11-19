/**
 * Compresión de imágenes en el cliente para RutaViva.
 * Convierte un File en dataURL JPEG redimensionado (máx 960 px el lado mayor,
 * calidad 0.66). Endurecido en la Task 40: las fotos viven como base64 dentro
 * de la DB y Neon limita el plan gratis a 5 GB de transferencia/mes — cada
 * KB ahorrado aquí multiplica en cada lectura.
 */

const MAX_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_SIDE = 960;
const JPEG_QUALITY = 0.66;
/**
 * Tope por foto tras comprimir (auditoría 20-nov-2026): ~800 KB binarios.
 * Con el cap de body de Vercel (~4.5 MB), 5 fotos de este tamaño caben justo;
 * si una foto supera el tope (PNG muy complejo, cámara atípica), se aplica
 * una SEGUNDA pasada más agresiva (720 px, calidad 0.5) antes de rendirse.
 */
const TARGET_MAX_CHARS = 1_100_000;

/** Área de recorte en píxeles NATURALES de la imagen original. */
export type CropArea = { x: number; y: number; width: number; height: number };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("La imagen no se pudo procesar."));
    img.src = src;
  });
}

/**
 * Dibuja `source` en un canvas de destW×destH y devuelve JPEG dataURL.
 * Con origen (sx/sy/sw/sh) = recorte; con fondo blanco cuando el destino
 * puede tener transparencia (PNG) para que no se aplane a negro en JPEG.
 * Devuelve "" si el canvas no está disponible.
 */
function canvasToJpeg(
  source: CanvasImageSource,
  destW: number,
  destH: number,
  quality: number,
  opts: { sx?: number; sy?: number; sw?: number; sh?: number; fillWhite?: boolean } = {}
): string {
  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  if (opts.fillWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, destW, destH);
  }
  if (opts.sw && opts.sh) {
    ctx.drawImage(source, opts.sx ?? 0, opts.sy ?? 0, opts.sw, opts.sh, 0, 0, destW, destH);
  } else {
    ctx.drawImage(source, 0, 0, destW, destH);
  }
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Redimensiona y comprime una imagen seleccionada por el usuario.
 * Rechaza archivos > 12 MB con un error claro. Si el navegador no puede
 * procesar el redimensionado, devuelve el dataURL original (mejor intentarlo).
 */
export async function fileToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo no es una imagen. Elige una foto (JPG o PNG).");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(
      "La imagen pesa más de 12 MB. Elige una más ligera o tómala con la cámara."
    );
  }

  const rawDataUrl = await readAsDataUrl(file);

  try {
    const img = await loadImage(rawDataUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (!longest) return rawDataUrl;

    const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    let out = canvasToJpeg(img, w, h, JPEG_QUALITY);

    // Red de seguridad: si aún pesa demasiado (p. ej. PNG muy detallado),
    // segunda pasada más agresiva en lugar de enviar megas de más.
    if (out.length > TARGET_MAX_CHARS) {
      const out2 = canvasToJpeg(
        img,
        Math.max(1, Math.round(w * 0.75)),
        Math.max(1, Math.round(h * 0.75)),
        0.5
      );
      if (out2.startsWith("data:image/") && out2.length < out.length) out = out2;
    }

    return out.length > 0 && out.startsWith("data:image/") ? out : rawDataUrl;
  } catch {
    // Sin redimensionado disponible: enviamos el original comprimido por el usuario.
    return rawDataUrl;
  }
}

/**
 * Recorta un área de la imagen (en píxeles NATURALES) y la comprime con el
 * MISMO estándar de subida: JPEG, lado mayor máx 960 px, calidad 0.66.
 * Lo usa el diálogo de recorte del panel (fotos de lugares).
 * Lanza error con mensaje en claro si el área es inválida o el origen de la
 * imagen (https externo sin CORS) impide leer los píxeles.
 */
export async function cropPhotoToDataUrl(url: string, area: CropArea): Promise<string> {
  if (area.width < 8 || area.height < 8) {
    throw new Error(
      "El recorte quedó demasiado pequeño. Arrastra las esquinas para cubrir más área."
    );
  }
  const img = await loadImage(url);
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error("La imagen no se pudo procesar para recortar.");
  }
  // Recorte acotado a los límites reales de la imagen (evita bordes vacíos).
  const sx = Math.max(0, Math.min(Math.round(area.x), img.naturalWidth - 1));
  const sy = Math.max(0, Math.min(Math.round(area.y), img.naturalHeight - 1));
  const sw = Math.max(1, Math.round(Math.min(area.width, img.naturalWidth - sx)));
  const sh = Math.max(1, Math.round(Math.min(area.height, img.naturalHeight - sy)));

  const longest = Math.max(sw, sh);
  const scale = longest > MAX_SIDE ? MAX_SIDE / longest : 1;
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  try {
    // Fondo blanco: fotos con transparencia (PNG) no se aplanan a negro en JPEG.
    let out = canvasToJpeg(img, w, h, JPEG_QUALITY, { sx, sy, sw, sh, fillWhite: true });
    if (!out.startsWith("data:image/")) {
      throw new Error("No se pudo generar la imagen recortada.");
    }

    // Misma red de seguridad que la subida completa: recorte aún pesado →
    // segunda pasada a 0.75× y calidad 0.5 (misma vista, más comprimida).
    if (out.length > TARGET_MAX_CHARS) {
      const out2 = canvasToJpeg(
        img,
        Math.max(1, Math.round(w * 0.75)),
        Math.max(1, Math.round(h * 0.75)),
        0.5,
        { sx, sy, sw, sh, fillWhite: true }
      );
      if (out2.startsWith("data:image/") && out2.length < out.length) out = out2;
    }
    return out;
  } catch (err) {
    if (err instanceof DOMException && err.name === "SecurityError") {
      throw new Error(
        "Esta foto no se puede recortar porque viene de un origen externo. Edítala en tu dispositivo y súbela de nuevo."
      );
    }
    throw err;
  }
}
