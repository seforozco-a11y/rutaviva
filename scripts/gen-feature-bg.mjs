#!/usr/bin/env bun
/**
 * RutaViva — Generador del "Gráfico de promoción" (feature graphic) de Google Play.
 *
 * PASO A: genera el fondo con IA usando z-ai-web-dev-sdk DESDE BACKEND (nunca en cliente)
 *         → guardado temporal en docs/store-assets/_bg.png
 * PASO B: con sharp recorta/escala a EXACTAMENTE 1024×500 (cover) y compone:
 *         · overlay de degradado esmeralda oscuro desde la izquierda (legibilidad)
 *         · texto nítido vía SVG (NO IA): "RutaViva" + "Tu guía turística de Manzanillo"
 *         · pin de ubicación con brújula decorativo
 *         · badge "Disponible hoy en Manzanillo, Colima" (sugerido por docs/PLAY-STORE.md §3.4)
 * Salida: docs/store-assets/feature-graphic-1024x500.png (PNG sin transparencia, <15 MB)
 *
 * Uso:  bun scripts/gen-feature-bg.mjs
 * Fallback: si la generación IA falla tras 3 intentos, se compone un fondo de
 *           degradado esmeralda + texturas SVG (sin IA) para no bloquear la publicación.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import ZAI from 'z-ai-web-dev-sdk';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'store-assets');
const BG_TMP = path.join(OUT_DIR, '_bg.png');
const OUT = path.join(OUT_DIR, 'feature-graphic-1024x500.png');

const W = 1024;
const H = 500;

const PROMPT =
  'Vista aérea panorámica de la bahía de Manzanillo México al atardecer dorado, playas de arena, palmeras, ' +
  'embarcaciones pesqueras de colores, mar turquesa, estilo ilustración turística premium moderna, ' +
  'tonos esmeralda y dorado, sin texto';
// Nota: la API exige dimensiones múltiplos de 32 px (512–2880, máx 2^22 px). El '1440x720'
// sugerido se rechaza (720 no es múltiplo de 32) → se usa 1472x736, proporción ~2:1 equivalente.
const SIZE = '1472x736';

/* ---------------- PASO A · fondo con IA (z-ai-web-dev-sdk, backend) ---------------- */

async function generateBackground() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[IA] Generando fondo ${SIZE} (intento ${attempt}/3)...`);
      const zai = await ZAI.create();
      const res = await zai.images.generations.create({ prompt: PROMPT, size: SIZE });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error('la respuesta no incluyó base64');
      const buf = Buffer.from(b64, 'base64');
      if (buf.length < 10_000) throw new Error(`imagen sospechosamente pequeña (${buf.length} bytes)`);
      writeFileSync(BG_TMP, buf);
      const meta = await sharp(BG_TMP).metadata();
      console.log(`[IA] OK → ${BG_TMP} (${(buf.length / 1024 / 1024).toFixed(2)} MB, ${meta.width}x${meta.height})`);
      return true;
    } catch (err) {
      console.warn(`[IA] Intento ${attempt} falló: ${err?.message ?? err}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return false;
}

/* ---------------- PASO B · composición con sharp + SVG ---------------- */

// Pin de ubicación con rosa de los vientos (brújula) dentro — marca RutaViva.
function pinSvg(x, y, scale) {
  return `
  <g transform="translate(${x} ${y}) scale(${scale})">
    <!-- sombra suave del pin -->
    <ellipse cx="24" cy="47" rx="10" ry="3.4" fill="rgba(3,32,25,0.35)"/>
    <!-- pin -->
    <path d="M24 2C15.16 2 8 9.16 8 18c0 10.6 16 28 16 28s16-17.4 16-28C40 9.16 32.84 2 24 2z"
          fill="#ffffff"/>
    <path d="M24 2C15.16 2 8 9.16 8 18c0 10.6 16 28 16 28s16-17.4 16-28C40 9.16 32.84 2 24 2z"
          fill="none" stroke="rgba(6,78,59,0.35)" stroke-width="1.2"/>
    <!-- círculo interior (esmeralda profundo) -->
    <circle cx="24" cy="18" r="9.4" fill="#065f46"/>
    <circle cx="24" cy="18" r="9.4" fill="none" stroke="#34d399" stroke-width="1.1" opacity="0.9"/>
    <!-- aguja de brújula (N-S blanca, E-W verde) -->
    <path d="M24 10.6 L26.2 18 L24 25.4 L21.8 18 Z" fill="#ffffff"/>
    <path d="M16.6 18 L24 16.2 L31.4 18 L24 19.8 Z" fill="#34d399" opacity="0.85"/>
    <circle cx="24" cy="18" r="1.7" fill="#065f46" stroke="#ffffff" stroke-width="0.7"/>
  </g>`;
}

// Rosa de los vientos decorativa, marca de agua discreta.
function compassRoseSvg(x, y, size, opacity) {
  const r = size / 2;
  return `
  <g transform="translate(${x} ${y})" opacity="${opacity}">
    <circle r="${r}" fill="none" stroke="#ffffff" stroke-width="1.6"/>
    <circle r="${r * 0.72}" fill="none" stroke="#ffffff" stroke-width="0.9"/>
    <path d="M0 ${-r * 0.92} L${r * 0.14} 0 L0 ${r * 0.92} L${-r * 0.14} 0 Z" fill="#ffffff"/>
    <path d="M${-r * 0.92} 0 L0 ${-r * 0.14} L${r * 0.92} 0 L0 ${r * 0.14} Z" fill="#ffffff" opacity="0.75"/>
    <circle r="${r * 0.1}" fill="#0b3d2e"/>
  </g>`;
}

// Overlay completo 1024×500: degradado esmeralda desde la izquierda + textos + decoración.
function overlaySvg() {
  const title = 'RutaViva';
  const subtitle = 'Tu guía turística de Manzanillo';
  const badge = 'Disponible hoy en Manzanillo, Colima';
  const FONT = "'Liberation Sans','DejaVu Sans',Arial,sans-serif";

  const badgeW = 434;
  const badgeX = 96;
  const badgeY = 366;

  return Buffer.from(`
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="legibility" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0.00" stop-color="#03251c" stop-opacity="0.94"/>
      <stop offset="0.30" stop-color="#064e3b" stop-opacity="0.82"/>
      <stop offset="0.55" stop-color="#064e3b" stop-opacity="0.38"/>
      <stop offset="0.78" stop-color="#064e3b" stop-opacity="0.10"/>
      <stop offset="1.00" stop-color="#064e3b" stop-opacity="0.00"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0.00" stop-color="#03251c" stop-opacity="0.45"/>
      <stop offset="0.18" stop-color="#03251c" stop-opacity="0.12"/>
      <stop offset="0.35" stop-color="#03251c" stop-opacity="0.00"/>
    </linearGradient>
  </defs>

  <!-- degradados de legibilidad -->
  <rect width="${W}" height="${H}" fill="url(#legibility)"/>
  <rect width="${W}" height="${H}" fill="url(#bottom)"/>

  <!-- línea de acento esmeralda a la izquierda -->
  <rect x="0" y="0" width="7" height="${H}" fill="#059669"/>
  <rect x="7" y="0" width="3" height="${H}" fill="#34d399" opacity="0.55"/>

  <!-- rosa de los vientos decorativa (derecha) -->
  ${compassRoseSvg(902, 396, 118, 0.30)}
  ${compassRoseSvg(836, 118, 46, 0.16)}

  <!-- pin de ubicación con brújula -->
  ${pinSvg(96, 102, 1.85)}

  <!-- sombras de texto (manuales, sin filtros) -->
  <text x="100" y="287" font-family="${FONT}" font-weight="bold" font-size="96" letter-spacing="1"
        fill="rgba(3,32,25,0.45)">${title}</text>
  <text x="99" y="341" font-family="${FONT}" font-weight="normal" font-size="33" letter-spacing="0.4"
        fill="rgba(3,32,25,0.40)">${subtitle}</text>

  <!-- título y subtítulo nítidos -->
  <text x="96" y="283" font-family="${FONT}" font-weight="bold" font-size="96" letter-spacing="1"
        fill="#ffffff">${title}</text>
  <text x="98" y="337" font-family="${FONT}" font-weight="normal" font-size="33" letter-spacing="0.4"
        fill="#d1fae5">${subtitle}</text>

  <!-- badge -->
  <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="46" rx="23"
        fill="rgba(6,78,59,0.55)" stroke="#6ee7b7" stroke-opacity="0.75" stroke-width="1.6"/>
  <circle cx="${badgeX + 24}" cy="${badgeY + 23}" r="5.2" fill="#34d399"/>
  <text x="${badgeX + 42}" y="${badgeY + 30}" font-family="${FONT}" font-weight="bold" font-size="20.5"
        letter-spacing="0.6" fill="#ecfdf5">${badge}</text>
</svg>`);
}

// Fondo de emergencia (sin IA): degradado esmeralda + texturas SVG simples.
function fallbackBgSvg() {
  return Buffer.from(`
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0.00" stop-color="#022c22"/>
      <stop offset="0.45" stop-color="#064e3b"/>
      <stop offset="1.00" stop-color="#059669"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.78" cy="0.30" r="0.45">
      <stop offset="0.00" stop-color="#fbbf24" stop-opacity="0.55"/>
      <stop offset="0.55" stop-color="#fbbf24" stop-opacity="0.12"/>
      <stop offset="1.00" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <!-- olas estilizadas -->
  <path d="M0 330 C 170 300, 330 360, 512 340 S 860 300, 1024 330 L1024 500 L0 500 Z"
        fill="#022c22" opacity="0.35"/>
  <path d="M0 388 C 190 358, 360 412, 560 392 S 880 356, 1024 386 L1024 500 L0 500 Z"
        fill="#022c22" opacity="0.45"/>
  <!-- palmera estilizada -->
  <g transform="translate(880 500)" opacity="0.35" fill="#022c22">
    <path d="M0 0 C -6 -90, 10 -150, 34 -190 L 44 -186 C 24 -146, 10 -92, 14 0 Z"/>
    <path d="M40 -188 C 10 -206, -34 -206, -60 -184 C -28 -196, 6 -192, 40 -176 Z"/>
    <path d="M42 -190 C 52 -222, 92 -238, 128 -232 C 94 -224, 64 -208, 50 -182 Z"/>
    <path d="M44 -186 C 78 -204, 118 -198, 140 -176 C 110 -190, 76 -190, 50 -176 Z"/>
    <path d="M38 -192 C 20 -220, -14 -232, -48 -230 C -18 -218, 8 -206, 30 -182 Z"/>
  </g>
  ${compassRoseSvg(180, 120, 150, 0.10)}
</svg>`);
}

async function compose({ usedFallback }) {
  const bgInput = usedFallback ? fallbackBgSvg() : BG_TMP;
  const label = usedFallback ? 'fondo degradado SVG (fallback sin IA)' : `fondo IA (${SIZE})`;

  // Etapa 1: recorte/escala a 1024×500 (cover) + overlay SVG (textos nítidos).
  const composed = await sharp(bgInput)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .composite([{ input: overlaySvg(), top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Etapa 2: Play exige el feature graphic SIN transparencia — aplanamos a RGB.
  // (sharp aplica composite al final del pipeline, por eso el flatten va en una 2.ª pasada)
  const final = await sharp(composed)
    .flatten({ background: '#03251c' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(OUT, final);

  // Verificación obligatoria: metadatos exactos
  const meta = await sharp(OUT).metadata();
  const bytes = readFileSync(OUT).length;
  console.log('──────────────────────────────────────────────────');
  console.log(`[OK] Feature graphic: ${path.relative(ROOT, OUT)}`);
  console.log(`     fondo usado: ${label}`);
  console.log(`     dimensiones: ${meta.width}x${meta.height} (formato ${meta.format})`);
  console.log(`     canales: ${meta.channels} · hasAlpha: ${meta.hasAlpha} (Play exige sin transparencia)`);
  console.log(`     peso: ${(bytes / 1024).toFixed(1)} KB (límite 15 MB)`);
  console.log('──────────────────────────────────────────────────');

  if (meta.width !== W || meta.height !== H || meta.format !== 'png') {
    throw new Error(`verificación fallida: se obtuvo ${meta.width}x${meta.height} ${meta.format}`);
  }
  if (meta.hasAlpha) {
    throw new Error('el PNG final tiene canal alfa; Play exige feature graphic sin transparencia');
  }
  if (bytes > 15 * 1024 * 1024) {
    throw new Error('el PNG excede los 15 MB');
  }
}

/* ---------------- main ---------------- */

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  let usedFallback = false;
  if (existsSync(BG_TMP)) {
    console.log(`[IA] Reutilizando fondo existente: ${BG_TMP}`);
  } else {
    usedFallback = !(await generateBackground());
    if (usedFallback) {
      console.warn('[FALLBACK] La generación IA falló tras 3 intentos.');
      console.warn('[FALLBACK] Se compone el feature graphic con degradado esmeralda + texturas SVG (sin IA).');
    }
  }

  await compose({ usedFallback });
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
