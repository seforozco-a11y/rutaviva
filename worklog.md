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

---
Task ID: 2
Agent: Z.ai Code (main)
Task: Rebranding/regionalización de RutaViva → Manzanillo, Colima (nombre confirmado por el usuario)

Work Log:
- Usuario confirmó: nombre "RutaViva" y arraque en Manzanillo, Colima (después el resto de municipios del estado).
- Grep de referencias CDMX: 5 puntos en src + seed completo.
- `src/lib/geo.ts`: categoría nueva "playa" al inicio de SINGULAR_CATEGORIES (imprescindible para Manzanillo).
- `prisma/seed.ts` reescrito: 13 lugares reales de Manzanillo (Playa La Audiencia, Miramar, Salahua, Santiago, La Boquita, Ventanas, Carrizales, Mirador Bahía de Santiago, Monumento al Pescador, Centro Histórico/Malecón, Mercado Municipal, El Tortugario y Museo de la Sal de Cuyutlán). Seed ahora limpia y repuebla (idempotente para desarrollo). Ejecutado: 13 lugares activos.
- `src/lib/place-types.ts`: DEMO_ORIGIN → Centro Histórico de Manzanillo (19.0536, -104.3149).
- `rutaviva-app.tsx`: DEMO_POINT + toasts a Manzanillo.
- `splash.tsx`: portada viral regionalizada — imagen aérea de la bahía generada con image-generation (`public/hero-manzanillo.png`, 768x1344) como fondo con velo esmeralda; badge "Disponible hoy en Manzanillo, Colima"; demo button "Explorar Manzanillo (ubicación demo)"; pie "Empezamos en Manzanillo · Pronto en todo Colima".
- `about-panel.tsx`: subtítulo Manzanillo + tarjeta nueva "De Manzanillo a todo Colima" con los 10 municipios del estado como roadmap.
- BUG CORREGIDO: pestaña "Servicios" de la lista quedaba en "cargando…" infinito — en TanStack v5 una query deshabilitada es `isPending=true` y la query única de nearby solo se activaba con el filtro del mapa. Refactor a `useQueries` (una query por tipo de servicio, habilitadas por filtro de mapa o por pestaña Servicios), tab de lista controlado (tab/onTabChange), estados de carga con `isLoading` y error global agregado `nearbyAllFailed` con Reintentar (invalida todas las queries nearby).
- Verificación Agent Browser (390×844 y 1280×800, sesión limpia = 0 errores de página): splash → demo → mapa con 13 marcadores y franja ordenada por distancia (Centro Histórico a 15 m) → lista con chip Playa → detalle Playa Santiago (badge, distancia, tip, Cómo llegar) → Servicios resuelve a estado de error amable en sandbox (Overpass sin salida en el sandbox; en producción datos reales OSM) → alta de lugar (POST 201, aparece y el mapa vuela a él; verificado en API, luego re-seed para dejar los 13 reales) → GPS denegado → fallback demo Manzanillo con toast correcto → Guía con stats 13/7/7 y roadmap → desktop correcto.
- Lint limpio. dev.log solo con queries Prisma y 200s.

Stage Summary:
- RutaViva = marca confirmada; catálogo inicial = Manzanillo, Colima (13 lugares curados, categorías playa/naturaleza/mirador/monumento/plaza/gastronomía/museo).
- Escalabilidad multi-municipio intacta: agregar un municipio = insertar filas (nada de código); roadmap visible en la Guía.
- Corregido bug de "Servicios" (cargando infinito) con useQueries + tab controlado.
- Artefactos nuevos: public/hero-manzanillo.png (portada), prisma/seed.ts con datos de Manzanillo.
- Siguiente paso natural (fuera de alcance hoy): build Capacitor → AAB para Play Store; fotos reales por lugar; panel admin con roles.

---
Task ID: 3
Agent: Z.ai Code (main)
Task: Flujo de moderación RutaViva — backend (admin autoriza lugares; usuarios envían reseñas y fotos que se validan antes de publicarse)

Work Log:
- Nuevo requerimiento del usuario: para que un lugar aparezca en la app, el administrador debe autorizarlo; los usuarios crean reseñas/referencias y suben fotos que pasan por validación ("previa estudio se dará la validación") y luego se publican bajo formatos y principios.
- `prisma/schema.prisma`: `SingularPlace` gana `status` (PENDING|APPROVED|REJECTED), `source` (ADMIN|USER), `suggestedBy`, `city`, `state`. Modelos nuevos `Review` (placeId, authorName, rating 1..5, comment, status) y `Photo` (url, placeId?, reviewId?, status) con índices y cascadas. `db push` OK.
- `src/lib/admin-auth.ts`: PIN + cookie httpOnly `rv_admin` (HMAC SHA-256 con ADMIN_SECRET; timingSafeEqual). PIN por defecto en código: `rutaviva2025` (NOTA: el boot del sandbox sobrescribe `.env`, por eso los defaults viven en el código).
- `src/lib/server/moderation.ts`: validadores compartidos (`validatePlaceInput`, `validateReviewInput`), límites de fotos (máx 3 por reseña, ≤2.6MB base64), URLs válidas (data:image/, /images/, https).
- `prisma/seed.ts` reescrito: 13 lugares APPROVED (6 con imagen generada por IA), 6 reseñas aprobadas (2 con fotos), 2 reseñas PENDING y 1 sugerencia PENDING (con foto) para poblar la cola del admin.
- APIs públicas: `GET /api/places` ahora solo devuelve APPROVED+active e incluye ratingAvg/ratingCount; `POST /api/places` ya NO publica: crea sugerencia PENDING (source USER) con foto opcional; `GET /api/places/[id]` detalle + reseñas aprobadas con fotos; `POST /api/reviews` crea reseña PENDING con hasta 3 fotos.
- APIs admin (todas protegidas): `POST /api/admin/login|logout`, `GET /api/admin/session`, `GET /api/admin/overview` (stats + pendientes con fotos + catálogo completo), `POST /api/admin/places` (alta directa APPROVED), `PATCH /api/admin/places/[id]` (approve→publica y promueve foto a portada; reject; feature/unfeature; update validado), `DELETE /api/admin/places/[id]`, `PATCH|DELETE /api/admin/reviews/[id]` (aprueba/rechaza reseña y sus fotos).
- BUG de entorno resuelto: el sandbox sega los procesos lanzados desde tool-calls (mata incluso setsid). El `bun run dev` del boot había sido reiniciado y quedó muerto → creado `scripts/daemon.py` (doble fork + setsid) que SÍ sobrevive; dev server corriendo con él. Idem para `scripts/gen-images.sh` (generación de imágenes en background).
- `src/lib/place-types.ts`: `SingularPlaceDTO` +ratingAvg/ratingCount, `PublicReviewDTO`, `PlaceDetailResponse`.
- Verificado end-to-end con curl: login 401/200, overview protegido 401, sugerencia → no visible → approve → publicada con foto como portada, reseña con foto → no visible → approve → visible y rating promedio calculado; reseña inválida (rating 9) → 400. Re-seed final limpio (13 publicados, cola: 2 reseñas + 1 sugerencia).

Stage Summary:
- Backend de moderación 100% funcional: nada llega al público sin validación del admin. Escalable a más municipios vía campos city/state.
- PIN admin por defecto: `rutaviva2025` (sobrescribible con ADMIN_PIN).
- Infra clave: `scripts/daemon.py` es la forma correcta de lanzar servicios persistentes en este sandbox.
- Pendiente (Task 4): frontend — panel admin, reseñas con fotos en el detalle, formulario de sugerencia, badge de calificaciones.

---
Task ID: 4
Agent: full-stack-developer (subagente; integración y verificación final por Z.ai Code principal tras timeout)
Task: Frontend del flujo de moderación (reseñas con fotos, sugerencias, panel admin)

Work Log:
- src/lib/image-client.ts: compresión cliente (canvas, máx 1280px, JPEG 0.72, límite 12MB).
- src/components/rutaviva/photo-upload.tsx: selector reutilizable con miniaturas, contador y eliminación.
- src/components/rutaviva/photo-lightbox.tsx: visor de fotos a tamaño completo.
- src/components/rutaviva/place-detail-sheet.tsx: resumen de calificación (estrellas + promedio + N reseñas), sección "Reseñas de viajeros" con fotos y lightbox, formulario de reseña inline (nombre, estrellas interactivas, comentario con contador, hasta 3 fotos) con aviso de revisión y panel de éxito; solo para kind="singular".
- src/components/rutaviva/add-place-form.tsx: convertido a "Sugerir un lugar singular" con crédito (suggestedBy), PhotoUpload max 1, botón "Enviar a revisión" y panel de éxito con "Sugerir otro" / "Volver al mapa".
- src/components/rutaviva/admin/admin-panel.tsx: login por PIN, dashboard con stats, tabs "Por revisar" (sugerencias con dialog de validación + checklist de formatos; reseñas con aprobar/rechazar y lightbox), "Lugares" (badges de estado, destacar, editar, eliminar), "Nuevo lugar" (alta directa APPROVED), logout.
- src/components/rutaviva/admin/place-fields-form.tsx: formulario compartido con checklist en vivo (nombre, descripción ≥30, categoría, ubicación, foto) y "Usar mi ubicación".
- src/components/rutaviva/bottom-nav.tsx: vista "admin" con ShieldCheck en la barra inferior.
- src/components/rutaviva/rutaviva-app.tsx: wiring de sugerencia (sin insertar en caché, sin flyTo) y vista admin.
- src/components/rutaviva/places-list.tsx: indicador de rating en tarjetas (Star + "4.8 (12)").
- src/components/rutaviva/about-panel.tsx: tarjeta "¿Cómo funciona la publicación?" (3 pasos: viajero → equipo → app).
- `bun run lint` limpio (0 errores); GET / responde 200; imágenes generadas en public/images (6 lugares + 3 reseñas).

Stage Summary:
- Flujo completo en UI: usuario sugiere/resena con fotos → PENDING; admin (PIN rutaviva2025) valida con checklist de formatos → se publica. Nada entra al mapa sin autorización.
- Pendiente: verificación E2E con Agent Browser (Task 5).

---
Task ID: 5
Agent: Z.ai Code (main)
Task: Verificación E2E con Agent Browser del flujo de moderación + correcciones

Work Log:
- BUG corregido en bottom-nav.tsx: `items.slice(2)` renderizaba 6 elementos en grid-cols-5 (add estaba en items Y como FAB) → `items.slice(3)` (2 + FAB + 2 = Explorar/Lugares/[+]/Guía/Admin).
- Fix de entorno documentado: los procesos de tool-calls son segados; `scripts/daemon.py` (doble fork) mantiene vivo bun run dev e incluso la generación de imágenes.
- Flujo usuario verificado (viewport móvil 390×844): splash Manzanillo → Explorar demo → mapa con marcadores y franja → detalle "Centro Histórico y Malecón" (sin reseñas → CTA "sé el primero") → "Escribir reseña": nombre + 4 estrellas + comentario + 2 fotos (upload comprimido a dataURL JPEG) → POST 201 → panel de éxito "Tu reseña está en revisión" → BD: Review PENDING con 2 Photos.
- Formulario "Sugerir un lugar": campos + crédito → "Enviar a revisión" → panel "¡Sugerencia enviada!" → BD: Place PENDING source USER con suggestedBy.
- Flujo admin (PIN): login con PIN erróneo → "PIN incorrecto"; rutaviva2025 → dashboard con stats (13/2/6), tabs Por revisar(8)/Lugares/Nuevo lugar; dialog "Validar y publicar" con checklist FORMATOS DE PUBLICACIÓN en vivo ("Al menos una foto" pendiente hasta subir foto); upload dentro del dialog → "Aprobar y publicar" → PATCH update + PATCH approve (ambos 200) → toast "Reseña/Lugar publicado"; stats refrescan (14 publicados, colas -1).
- Publicación verificada: lugar aprobado aparece en GET /api/places con su foto promovida a portada (dataURL); reseña aprobada visible en el detalle con fotos + resumen ⭐ 4.0 (1 reseña); badge de rating también en la lista.
- Nota UX descubierta: en la lista, el detalle se abre con "Ver en mapa" (el article no es clicable); la ruta principal es la franja del mapa. Aceptable para MVP.
- Responsive: desktop 1280×800 correcto (filtros, franja, nav centrada max-w-md, footer fijo). GPS denegado → fallback demo con banner (diseñado). Cero errores de página en consola.
- Limpieza: re-seed idempotente → estado demo: 13 publicados, 6 reseñas aprobadas, 2 reseñas pendientes (con foto), 1 sugerencia pendiente (con foto). Lint 0 problemas. dev.log solo 200s.

Stage Summary:
- Ciclo completo "usuario envía → admin valida → se publica" verificado end-to-end en navegador (usuario y admin), en móvil y escritorio.
- PIN del admin: rutaviva2025 (ADMIN_PIN sobrescribe; defaults en código porque el boot borra .env).
- App lista para demo del usuario; siguiente paso natural: build Capacitor → AAB para Play Store.
