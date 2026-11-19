"use client";

/**
 * Error boundary de RutaViva (auditoría 20-nov-2026).
 * Si un componente explota en runtime (mapa, ficha, cualquier vista), la app
 * muestra este panel en lugar de la pantalla en blanco: el usuario
 * puede reintentar sin perder el navegador ni la sesión.
 */
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Reporte mínimo a consola para diagnóstico desde el panel de Vercel.
  useEffect(() => {
    console.error("[RutaViva error boundary]", error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-black tracking-tight text-stone-800">
          Algo se interrumpió
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          No pudimos mostrar esta parte de RutaViva, pero tus datos están bien.
          Intenta de nuevo; si persiste, espera unos segundos y recarga.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="min-h-11 rounded-full bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-full border border-stone-300 bg-white px-6 py-2.5 text-sm font-bold text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
          >
            Recargar la app
          </button>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-stone-400">Código de apoyo: {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
