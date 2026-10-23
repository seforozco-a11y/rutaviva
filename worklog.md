# Worklog

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Guía turística móvil multiplataforma (RutaViva) — MVP funcional en Next.js + ruta a APK

Work Log:
- Definido modelo `SingularPlace` en `prisma/schema.prisma` (nombre, descripción, categoría, lat/lng, dirección, imagen, tips, featured, active) + índices. Push a SQLite (`db/custom.db`).
- Seed de 12 lugares singulares de CDMX (`prisma/seed.ts`, ejecutado con `bun prisma/seed.ts`).
- Instalado `leaflet`, `react-leaflet`, `@types/leaflet`.
- Creado `src/lib/geo.ts` (Haversine, categorías singulares, tipos comunes OSM, URLs de direcciones) y `src/lib/place-types.ts`.
- API `GET/POST /api/places` (orden por cercanía, validación zod-less con límites) y `GET /api/nearby` (proxy Overpass con caché en memoria 5 min) — fallback de producción.
- Cliente Overpass en `src/lib/nearby-client.ts` (el sandbox no tiene salida a internet desde el servidor; Overpass soporta CORS y se consulta desde el navegador, con respaldo a `/api/nearby`).
- Logo generado con skill image-generation (`public/icon-1024.png`) + redimensionado a 192/512 con sharp. `public/manifest.webmanifest` (PWA standalone, portrait, theme emerald).
- Frontend (todo en `/`): Splash viral con framer-motion (`splash.tsx`), mapa Leaflet con divIcons personalizados y controles propios (`map-canvas.tsx`), overlays de filtros/franja de tarjetas/FAB (`map-view.tsx`), lista con búsqueda y segmentado Singulares/Servicios (`places-list.tsx`), formulario alta lugares (`add-place-form.tsx`), panel Guía con stats (`about-panel.tsx`), bottom-sheet de detalle (vaul, `place-detail-sheet.tsx`), nav inferior estilo app con FAB central (`bottom-nav.tsx`), orquestador con TanStack Query (`rutaviva-app.tsx`), `providers.tsx` (QueryClientProvider).
- Tema emerald en `globals.css` + CSS de marcadores (.rv-pin, .rv-dot, .rv-user-marker) + overrides de z-index para drawer/toasts sobre los overlays del mapa.
- Layout con metadata es-MX, viewport, manifest, íconos; lang="es".

Bugs encontrados y corregidos durante la verificación con Agent Browser:
1. Drawer (vaul) quedaba bajo los overlays del mapa (z-50 vs z-850+) → override CSS `[data-slot="drawer-content"] { z-index: 1101 }` + overlay 1100 + toast viewport 1200.
2. `Number(null) === 0` en parsing de query params: `GET /api/places` sin `lat/lng` filtraba desde (0,0) y devolvía 0 lugares → parsing explícito (`latParam ? Number(...) : NaN`) en `/api/places` y `/api/nearby`.
3. Reglas `react-hooks/set-state-in-effect` de Next 16 → refactor a TanStack Query para estado del servidor (places/nearby) y `setTimeout(0)` para el gate de onboarding.

Stage Summary:
- MVP RutaViva 100% funcional verificado end-to-end con Agent Browser en móvil (390×844) y desktop (1280×800): splash → GPS (con fallback demo CDMX verificado) → mapa con marcadores singulares/comunes → filtros → franja de tarjetas → detalle (drawer) → lista ordenada por distancia → alta de lugar singular (POST 201 verificado, aparece al instante) → Guía con stats reales.
- APIs: `/api/places` (13 lugares: 12 seed + 1 creado en pruebas) y `/api/nearby` (proxy Overpass con caché). Overpass se consume directo desde el cliente con fallback al proxy del servidor.
- Ruta a producción móvil documentada: PWA → Capacitor → AAB para Play Store; iOS después con la misma base.
- Estado del arte: lint limpio (0 errores), dev.log sin errores de runtime (solo los fallos esperados de Overpass del sandbox).
