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
};

export default nextConfig;
