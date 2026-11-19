import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* exceljs usa requires dinámicos: debe quedar fuera del bundle del
     servidor para que la generación del respaldo Excel funcione en Vercel. */
  serverExternalPackages: ["exceljs"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  /**
   * Cabeceras de seguridad (auditoría 20-nov-2026):
   * - nosniff: evita que el navegador adivine tipos MIME de respuestas.
   * - Referrer-Policy: no filtra URLs completas al salir a terceros (tiles).
   * - Permissions-Policy: la geolocalización y cámara solo las pide la propia
   *   app (no iframes de terceros).
   * X-Frame-Options SOLO en /api/admin/*: proteger el panel contra
   * clickjacking sin romper la vista previa embebida de la app (el panel de
   * la usuaria y posibles integraciones cargan la app en un iframe de otro
   * origen; XFO global la bloquearía en blanco). El riesgo de clickjacking
   * sobre un mapa público es nulo y la cookie de admin es SameSite.
   * NOTA: sin CSP estricto a propósito — Leaflet + tiles de OpenStreetMap y
   * imágenes data:/api lo harían frágil; se evaluará aparte.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(self)" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
