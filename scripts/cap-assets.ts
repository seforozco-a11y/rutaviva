// Genera assets/ para @capacitor/assets (Android: íconos + splash)
// Ejecutar: bun scripts/cap-assets.ts
import sharp from "sharp";
import { mkdirSync } from "fs";

const ROOT = "/home/z/my-project";
const SRC_ICON = `${ROOT}/public/icon-1024.png`;
mkdirSync(`${ROOT}/assets`, { recursive: true });

async function main() {
  const meta = await sharp(SRC_ICON).metadata();
  const hasAlpha = meta.channels === 4;
  console.log("icon meta:", meta.width, "x", meta.height, "channels:", meta.channels, "alpha:", hasAlpha);

  // 1) Icono cuadrado 1024: si el PNG no trae alpha, aplana sobre fondo verde del propio ícono
  const iconBase = sharp(SRC_ICON).resize(1024, 1024, { fit: "cover" });
  if (!hasAlpha) {
    await iconBase.flatten({ background: "#43a047" }).png().toFile(`${ROOT}/assets/icon.png`);
  } else {
    // sobre fondo verde para adaptive icons
    const bg = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#43a047" } }).png().toBuffer();
    await sharp(bg).composite([{ input: await iconBase.png().toBuffer(), blend: "over" }]).png().toFile(`${ROOT}/assets/icon.png`);
  }

  // 2) Splash 2732x2732: degradado esmeralda + ícono centrado
  const W = 2732;
  const svgBg = `<svg width="${W}" height="${W}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="55%" stop-color="#047857"/>
        <stop offset="100%" stop-color="#059669"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${W}" fill="url(#g)"/>
  </svg>`;
  const iconBuf = await sharp(SRC_ICON).resize(1100, 1100, { fit: "cover" }).png().toBuffer();
  const iconMeta = await sharp(iconBuf).metadata();
  await sharp(Buffer.from(svgBg))
    .composite([
      {
        input: iconBuf,
        left: Math.round((W - (iconMeta.width ?? 1100)) / 2),
        top: Math.round((W - (iconMeta.height ?? 1100)) / 2),
      },
    ])
    .png()
    .toFile(`${ROOT}/assets/splash.png`);

  // 3) Splash dark: mismo diseño (ya es oscuro)
  await sharp(`${ROOT}/assets/splash.png`).png().toFile(`${ROOT}/assets/splash-dark.png`);

  console.log("OK assets/: icon.png, splash.png, splash-dark.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
