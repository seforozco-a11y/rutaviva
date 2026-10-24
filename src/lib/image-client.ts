/**
 * Compresión de imágenes en el cliente para RutaViva.
 * Convierte un File en dataURL JPEG redimensionado (máx 1280 px el lado mayor,
 * calidad 0.72) para que quepa cómodamente en los límites de la API.
 */

const MAX_INPUT_BYTES = 12 * 1024 * 1024; // 12 MB
const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.72;

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
