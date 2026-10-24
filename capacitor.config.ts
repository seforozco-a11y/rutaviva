import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuración de Capacitor para la app Android de RutaViva.
 *
 * Arquitectura: la app nativa carga la web app (Next.js) desde un servidor
 * HTTPS público — la misma app con su panel admin y base de datos. Así el APK
 * siempre muestra contenido autorizado y moderado sin recompilar datos.
 *
 * CAP_SERVER_URL: URL del backend desplegado (ej. https://rutaviva.tudominio.com).
 *   - CI de GitHub Actions la define con el secret CAP_SERVER_URL.
 *   - En desarrollo local sin la variable se usa el emulador de Android
 *     (10.0.2.2 = localhost del host desde el emulador), con cleartext habilitado.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "http://10.0.2.2:3000";
const isProd = serverUrl.startsWith("https://");

const config: CapacitorConfig = {
  appId: "com.rutaviva.colima",
  appName: "RutaViva",
  // Contenido web de respaldo incluido en el APK (íconos/manifiesto); la app
  // real se carga desde server.url.
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: !isProd, // http solo en desarrollo
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: !isProd,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#064e3b",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Geolocation: {
      // Permisos los maneja el plugin (ACCESS_COARSE/FINE_LOCATION se
      // fusionan al manifest automáticamente).
    },
  },
};

export default config;
