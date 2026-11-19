"use client";

/**
 * Última red de seguridad (auditoría 20-nov-2026): si el error ocurre en el
 * layout raíz (fuera del error.tsx normal), esta pantalla sustituye TODO el
 * documento. Debe ser un HTML mínimo sin dependencias del layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-MX">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafaf9",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 380,
            padding: 24,
            background: "#fff",
            border: "1px solid #e7e5e4",
            borderRadius: 16,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, color: "#292524" }}>
            RutaViva no pudo iniciar
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "#57534e" }}>
            Hubo un fallo grave al cargar la app. Revisa tu conexión y recarga;
            si persiste, avísanos desde «Ayuda y comentarios» más tarde.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "10px 24px",
              borderRadius: 9999,
              border: "none",
              background: "#047857",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
