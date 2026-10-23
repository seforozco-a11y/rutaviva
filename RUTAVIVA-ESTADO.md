# RutaViva · Estado del proyecto (documento de continuidad)

> **Guardado el:** fin de sesión de desarrollo — *"mañana le seguimos, guarda lo que llevamos avanzado"*
> **Objetivo de este documento:** que cualquier sesión futura retome el proyecto exactamente donde quedó, sin rehacer trabajo.

---

## 1. Visión confirmada (decisiones del usuario)

| Decisión | Valor confirmado |
|---|---|
| **Nombre de la app** | **RutaViva** |
| **Qué es** | Guía turística móvil para descubrir la ubicación del usuario y lugares "singulares" + servicios comunes (como Google Maps: tiendas de conveniencia, farmacias, gasolineras…) |
| **Plataformas** | Android (APK/AAB para **Google Play Store**) primero; **iOS en el futuro** |
| **Región inicial** | **Manzanillo, Colima, México** (después: los 10 municipios del estado) |
| **Gobernanza de contenido** | ① Solo el **administrador** autoriza que un lugar aparezca en la app. ② Los **usuarios** envían reseñas, referencias y fotos. ③ Todo pasa por **validación previa** ("previa estudio se dará la validación"). ④ Lo aprobado se publica **bajo formatos y principios** definidos. |
| **Escalabilidad** | Agregar un municipio/lugar = insertar datos, sin tocar código |

---

## 2. Qué está construido y VERIFICADO (funciona hoy)

### Aplicación móvil-first (web app / PWA en `/`)
- **Splash "portada viral"** con imagen aérea de la bahía de Manzanillo (generada por IA), badge *"Disponible hoy en Manzanillo, Colima"* y botón de ubicación demo.
- **Mapa interactivo (Leaflet)** con marcadores personalizados: lugares singulares (pines) y servicios comunes (puntos OSM vía Overpass), controles de filtro, franja de tarjetas ordenada por distancia real (Haversine).
- **Geolocalización GPS** con fallback a ubicación demo (Centro Histórico de Manzanillo, 19.0536, -104.3149) si el usuario niega el permiso.
- **Lista de lugares** con búsqueda, segmentado *Singulares / Servicios*, indicador de rating (⭐ 4.8 (12)).
- **Detalle (bottom-sheet)** con foto, distancia, tip, "Cómo llegar", resumen de calificación y **reseñas de viajeros con fotos + lightbox**.
- **Escribir reseña** inline: nombre, estrellas interactivas, comentario, hasta **3 fotos** (compresión cliente, máx 1280px JPEG) → queda **PENDING** con aviso "Tu reseña está en revisión".
- **Sugerir un lugar singular**: formulario con crédito al autor (`suggestedBy`) + 1 foto → **PENDING**, nunca se publica directo.
- **Guía** (panel "about"): stats reales, tarjeta "De Manzanillo a todo Colima" (roadmap de los 10 municipios), "¿Cómo funciona la publicación?" (3 pasos: viajero → equipo → app).
- **PWA**: `manifest.webmanifest` standalone portrait, íconos 192/512/1024, tema esmeralda.

### Panel de administración (rol admin, en la barra inferior de la app)
- **Login por PIN** (cookie httpOnly firmada con HMAC-SHA256, `timingSafeEqual`).
- **Dashboard** con stats (publicados / por revisar / reseñas).
- **Tab "Por revisar"**: sugerencias con **dialog "Validar y publicar"** + **checklist de formatos en vivo** (nombre, descripción ≥30, categoría, ubicación, foto); reseñas con aprobar/rechazar y visor de fotos.
- **Tab "Lugares"**: badges de estado, destacar (featured), editar, eliminar.
- **Tab "Nuevo lugar"**: alta directa APPROVED.
- Al aprobar una sugerencia con foto: se **publica y su foto se promueve a portada**.

### Backend (Next.js API Routes + Prisma/SQLite)
- `GET /api/places` — solo APPROVED+active, orden por cercanía, incluye ratingAvg/ratingCount.
- `GET /api/places/[id]` — detalle + reseñas aprobadas con fotos.
- `POST /api/places` — ya NO publica: crea **sugerencia PENDING** (source USER).
- `POST /api/reviews` — reseña PENDING con hasta 3 fotos (máx 2.6MB c/u, validación).
- `GET /api/nearby` — proxy Overpass con caché en memoria 5 min (respaldo del cliente).
- Admin (protegidos): `login|logout|session`, `overview` (stats + colas), `places` (alta directa), `places/[id]` (approve/reject/feature/update/delete), `reviews/[id]` (approve/reject).
- Validadores compartidos en `src/lib/server/moderation.ts`.

### Modelo de datos (Prisma — `prisma/schema.prisma`)
- `SingularPlace`: + `status` (PENDING/APPROVED/REJECTED), `source` (ADMIN/USER), `suggestedBy`, `city` (default "Manzanillo"), `state` (default "Colima").
- `Review`: placeId, authorName, rating 1..5, comment, status.
- `Photo`: url (dataURL o /images/), placeId?, reviewId?, status.
- Índices y cascadas listos para multi-municipio.

### Estado actual de la base de datos (verificado al guardar)
| Registro | Cantidad |
|---|---|
| Lugares publicados (APPROVED) | **13** (catálogo real de Manzanillo) |
| Sugerencias pendientes (PENDING) | **1** (para poblar la cola del admin) |
| Reseñas aprobadas | **6** (2 con fotos) |
| Reseñas pendientes | **2** |
| Fotos totales | 4 |

### Verificación E2E (hecha con Agent Browser — móvil 390×844 y desktop 1280×800)
- Splash → demo → mapa con marcadores y franja → detalle → reseña con 2 fotos → POST 201 → PENDING en BD. ✔
- Sugerencia de lugar → PENDING. ✔
- Admin: PIN erróneo → "PIN incorrecto"; PIN correcto → dashboard; validar con checklist → publicar → aparece en la app con foto como portada y rating recalculado. ✔
- Cero errores de página en consola; lint limpio (0 problemas); dev.log solo 200s. ✔

---

## 3. Acceso y operación

- **URL:** `/` (única ruta; todo es vistas dentro de `src/components/rutaviva/`).
- **PIN del admin (por defecto):** `rutaviva2025` — sobrescribible con env `ADMIN_PIN` (los defaults viven en código porque el boot del sandbox borra `.env`).
- **Servidor dev:** `bun run dev` puerto 3000. **IMPORTANTE en este sandbox:** los procesos lanzados desde tool-calls son segados; usar `scripts/daemon.py` (doble fork + setsid) para mantenerlo vivo.
- **Re-seed demo (idempotente):** `bun prisma/seed.ts`.
- **Servicios comunes (OSM/Overpass):** el sandbox no tiene salida a internet del servidor; el cliente los consulta directo a Overpass (CORS OK) con fallback al proxy `/api/nearby`. En producción con internet real, funcionarán las farmacias/gasolineras/tiendas reales.

---

## 4. Pendiente — Ruta siguiente (orden sugerido)

1. **Build Android → Google Play Store** (el paso pendiente #1):
   - `PWA → Capacitor` (envolver la web app) → `npx cap add android` → AAB firmado → Play Console (ficha, capturas, política de contenido UGC: declarar moderación y reporte de contenido, ya implementada ✅).
2. **Fotos en la nube**: hoy las fotos de usuarios viajan como dataURL en la BD (OK para demo). Para producción: Firebase Storage / Cloudinary / S3 + URL en `Photo.url`.
3. **Overpass/Maps en producción**: validar servicios comunes con internet real; opcionalmente migrar a Google Places API si se quiere experiencia tipo Google Maps.
4. **iOS**: misma base Capacitor → Xcode → App Store (después del lanzamiento Android).
5. **Expansión Colima**: alta de lugares de otros municipios (city/state ya existen; agregar selector de municipio en filtros/admin).
6. **Extras futuros**: roles múltiples admin, notificaciones de aprobación, modo offline, analytics.

## 5. Mapa rápido de archivos clave

```
src/components/rutaviva/   → splash, map-canvas, map-view, places-list, place-detail-sheet,
                             add-place-form, photo-upload, photo-lightbox, bottom-nav,
                             about-panel, rutaviva-app (orquestador), admin/ (panel+formulario)
src/app/api/               → places, reviews, nearby, admin/* (login/session/overview/places/reviews)
src/lib/                   → geo, place-types, admin-auth, image-client, nearby-client, db,
                             server/moderation (validadores de formatos)
prisma/schema.prisma       → SingularPlace, Review, Photo
prisma/seed.ts             → 13 lugares de Manzanillo + reseñas demo + cola pendiente
public/                    → icon-*, hero-manzanillo.png, manifest.webmanifest, images/places|reviews
scripts/daemon.py          → forma correcta de mantener procesos vivos en el sandbox
worklog.md                 → bitácora técnica detallada por tarea (Tasks 1-5)
```

---

*Detalle técnico completo de cada tarea en `worklog.md` (Tasks 1–5, verificación E2E incluida).*
