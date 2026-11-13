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

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawDataUrl;
    ctx.drawImage(img, 0, 0, w, h);

    const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
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
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no pudo procesar el recorte.");
    // Fondo blanco: fotos con transparencia (PNG) no se aplanan a negro en JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

    const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (!out.startsWith("data:image/")) {
      throw new Error("No se pudo generar la imagen recortada.");
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
