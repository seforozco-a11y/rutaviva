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

### Empaquetado Android (Capacitor 8) + CI — NUEVO
- **Proyecto `android/` completo** (`com.rutaviva.colima`, appName RutaViva, versionCode 1 / versionName 1.0.0, minSdk 24 / target+compile 36).
- **Arquitectura**: la app nativa carga el backend Next.js desplegado (`server.url` desde env `CAP_SERVER_URL`; default dev = emulador `10.0.2.2:3000` con cleartext). Un solo backend = web + APK siempre sincronizados.
- **Plugins**: `@capacitor/geolocation` (GPS de la portada; permisos ACCESS_FINE/COARSE ya en manifest) y `@capacitor/splash-screen` (splash esmeralda con ícono, 1.8s).
- **Assets generados**: 100 recursos (íconos adaptativos + splash en todas las densidades) desde `assets/icon.png` y `assets/splash.png` (composición sharp en `scripts/cap-assets.ts`, comando `bun run cap:assets`).
- **Firma release**: `android/app/build.gradle` lee `android/keystore.properties` (git-ignorado); sin él, artefacto sin firmar.
- **CI GitHub Actions** (`.github/workflows/android-build.yml`): en cada push a main genera **AAB + APK firmados** con secrets (`CAP_SERVER_URL`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); sin keystore secreto genera uno temporal SOLO de pruebas. Artefacto descargable: `rutaviva-android`.

### Cumplimiento UGC para Play Store — NUEVO
- **Botón "Reportar"** en cada reseña del detalle → dialog con motivo opcional (≤300) → `POST /api/reviews/[id]/report`.
- Reseña reportada se **oculta del público inmediatamente** (listado y detalle) y aparece en **"Reseñas reportadas"** del panel admin con su motivo → admin puede **Descartar reporte** (vuelve a visible) o **Rechazar reseña**.
- Respuesta de la política UGC de Play: moderación previa ✓ + reporte in-app ✓ + remoción por admin ✓ + reglas visibles ✓.

### Panel de administración (rol admin, en la barra inferior de la app)
- **Login por PIN** (cookie httpOnly firmada con HMAC-SHA256, `timingSafeEqual`).
- **Dashboard** con stats (publicados / por revisar / reseñas).
- **Tab "Por revisar"**: sugerencias con **dialog "Validar y publicar"** + **checklist de formatos en vivo** (nombre, descripción ≥30, categoría, ubicación, foto); reseñas con aprobar/rechazar y visor de fotos; **sección "Reseñas reportadas"** con motivo del reporte y acciones Descartar/Rechazar.
- **Tab "Lugares"**: badges de estado, destacar (featured), editar, eliminar.
- **Tab "Nuevo lugar"**: alta directa APPROVED.
- Al aprobar una sugerencia con foto: se **publica y su foto se promueve a portada**.

### Backend (Next.js API Routes + Prisma/SQLite)
- `GET /api/places` — solo APPROVED+active, orden por cercanía, incluye ratingAvg/ratingCount.
- `GET /api/places/[id]` — detalle + reseñas aprobadas con fotos.
- `POST /api/places` — ya NO publica: crea **sugerencia PENDING** (source USER).
- `POST /api/reviews` — reseña PENDING con hasta 3 fotos (máx 2.6MB c/u, validación).
- `POST /api/reviews/[id]/report` — reporte público anónimo de una reseña (motivo opcional; requisito UGC de Play).
- `GET /api/nearby` — proxy Overpass con caché en memoria 5 min (respaldo del cliente).
- Admin (protegidos): `login|logout|session`, `overview` (stats + colas), `places` (alta directa), `places/[id]` (approve/reject/feature/update/delete), `reviews/[id]` (approve/reject).
- Validadores compartidos en `src/lib/server/moderation.ts`.

### Modelo de datos (Prisma — `prisma/schema.prisma`)
- `SingularPlace`: + `status` (PENDING/APPROVED/REJECTED), `source` (ADMIN/USER), `suggestedBy`, `city` (default "Manzanillo"), `state` (default "Colima").
- `Review`: placeId, authorName, rating 1..5, comment, status, `flagged/flagReason/flaggedAt` (reporte UGC).
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

1. **Desplegar el backend en HTTPS público** (prerrequisito del APK): Vercel + Postgres/Supabase (migrar Prisma de sqlite a postgresql), Railway o VPS. Guía completa en `docs/PLAY-STORE.md` §3.
2. **Subir el repo a GitHub y disparar el build**: crear repo → push → el workflow genera el AAB (con secret `CAP_SERVER_URL` = URL del backend). Descargar artefacto `rutaviva-android`.
3. **Generar keystore de producción** (keytool, comando en la guía) y subirlo como secrets — el temporal del CI no sirve para publicar.
4. **Alta en Google Play Console**: cuenta developer (US$25), ficha con textos ya redactados en la guía, formularios (Seguridad de datos, IARC), **cambiar el PIN admin por defecto** (`rutaviva2025` → `ADMIN_PIN`), subida del AAB a pruebas internas/cerradas (cuenta personal nueva: 12 testers × 14 días) → producción.
5. **Fotos en la nube**: hoy las fotos de usuarios viajan como dataURL en la BD (OK para demo). Para producción: Firebase Storage / Cloudinary / S3 + URL en `Photo.url`.
6. **iOS**: misma base Capacitor → `cap add ios` (requiere Mac con Xcode) después del lanzamiento Android.
7. **Expansión Colima**: alta de lugares de otros municipios (city/state ya existen; agregar selector de municipio en filtros/admin).
8. **Extras futuros**: roles múltiples admin, notificaciones de aprobación, modo offline, analytics.

## 5. Mapa rápido de archivos clave

```
capacitor.config.ts        → config Capacitor 8 (appId com.rutaviva.colima, server.url)
android/                   → proyecto Android nativo (firma en app/build.gradle)
.github/workflows/         → android-build.yml (AAB firmado en CI)
assets/ + scripts/cap-assets.ts → fuente de íconos/splash Android
src/components/rutaviva/   → splash, map-canvas, map-view, places-list, place-detail-sheet,
                             add-place-form, photo-upload, photo-lightbox, bottom-nav,
                             about-panel, rutaviva-app (orquestador), admin/ (panel+formulario)
src/app/api/               → places, reviews (+report), nearby, admin/* (login/session/overview/places/reviews)
src/lib/                   → geo, place-types, admin-auth, image-client, nearby-client, db,
                             server/moderation (validadores de formatos)
prisma/schema.prisma       → SingularPlace, Review (+flagged), Photo
prisma/seed.ts             → 13 lugares de Manzanillo + reseñas demo + cola pendiente
public/                    → icon-*, hero-manzanillo.png, manifest.webmanifest, images/places|reviews
docs/PLAY-STORE.md         → guía completa de publicación en Google Play
scripts/daemon.py          → forma correcta de mantener procesos vivos en el sandbox
worklog.md                 → bitácora técnica detallada por tarea
```

---

*Detalle técnico completo de cada tarea en `worklog.md` (Tasks 1–5, verificación E2E incluida).*
