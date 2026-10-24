# RutaViva · Estado del proyecto (documento de continuidad)

> **Guardado el:** fin de sesión de despliegue — *"guarda todo y mañana continuamos"*
> **Objetivo de este documento:** que cualquier sesión futura retome el proyecto exactamente donde quedó, sin rehacer trabajo.
>
> **⚡ SITUACIÓN ACTUAL (guardado de esta sesión):** repo en GitHub ✓ · CI del AAB en marcha (fallo de cap sync ya corregido, run de verificación activo) · hosting pivota a **Vercel + Neon** (Railway tiene registros pausados oficialmente) · falta autorizar Vercel (device code nuevo al retomar) + crear DB Neon + secrets CI + Play Console. Detalle en §4.

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

### Infraestructura de despliegue — NUEVO (esta sesión)
- **GitHub: COMPLETADO.** Repo público `seforozco-a11y/rutaviva` (rama main). Autorización vía OAuth device flow con el client_id público de gh CLI (scopes repo+workflow; gh CLI no almacena el token por falta de read:org → usar `GH_TOKEN` env o URL autenticada para push).
- **CI del AAB:** tres fallos diagnosticados y corregidos en cadena: ① `android-actions/setup-android@v3` usaba el paquete SDK obsoleto `tools` → paso eliminado (SDK ya viene preinstalado en ubuntu-latest); ② `cap sync` exige `index.html` en webDir → **`webDir: "www"`** con `www/index.html` de respaldo (NO usar public/index.html: sombrearía la ruta `/` de Next); ③ `:app:validateSigningRelease` no hallaba el keystore → **`storeFile` resuelve relativo a `android/app/`**, no a la raíz `android/` → el workflow ahora escribe el .jks en `app/rutaviva-release.jks`. Run de verificación final: 40065285320 (resultado en /tmp/ci-run3.log o en la pestaña Actions).
- **Railway: DESCARTADO por ahora.** Registro de cuentas nuevas pausado oficialmente (incidente en status.railway.com desde 2026-10-23, sin ETA). El kit completo (Dockerfile, railway.toml, scripts/start-railway.sh, docs/RAILWAY.md) queda intacto como plan B cuando reabran.
- **Vercel + Neon: PLAN A.** Kit pusheado: `scripts/vercel-build.sh` (reescribe datasource a postgresql SOLO en el contenedor de build, prisma generate + db push no destructivo + seed-if-empty + next build; el desarrollo local sigue en SQLite), `vercel.json` (buildCommand + header privacidad), `package.json` con postinstall `prisma generate` + script `vercel-build`. Sin escrituras a disco en runtime (fotos = data URLs en BD) → serverless compatible. Vercel CLI 65.2.0 instalado en el sandbox.
- **Credenciales de producción generadas** (archivo `~/keystore-backup/produccion-credenciales.txt`): `ADMIN_PIN=RV669DD2`, `ADMIN_SECRET` (64 hex) y `KEYSTORE_PASSWORD`. El keystore .jks aún no se genera (se genera al configurar secrets CI).

---

## 3. Acceso y operación

- **URL:** `/` (única ruta; todo es vistas dentro de `src/components/rutaviva/`).
- **PIN del admin (por defecto):** `rutaviva2025` — sobrescribible con env `ADMIN_PIN` (los defaults viven en código porque el boot del sandbox borra `.env`).
- **Servidor dev:** `bun run dev` puerto 3000. **IMPORTANTE en este sandbox:** los procesos lanzados desde tool-calls son segados; usar `scripts/daemon.py` (doble fork + setsid) para mantenerlo vivo.
- **Re-seed demo (idempotente):** `bun prisma/seed.ts`.
- **Servicios comunes (OSM/Overpass):** el sandbox no tiene salida a internet del servidor; el cliente los consulta directo a Overpass (CORS OK) con fallback al proxy `/api/nearby`. En producción con internet real, funcionarán las farmacias/gasolineras/tiendas reales.

---

## 4. Pendiente — Ruta siguiente (orden actualizado tras esta sesión)

**✅ Hecho esta sesión:** GitHub repo + push completo · CI reparado (2 fallos: SDK obsoleto y webDir) · kit Vercel+Neon pusheado · credenciales de producción generadas.

**Mañana, en orden:**
1. **Verificar el run CI 40064998672** (verificación del fix webDir): debe terminar en `success` y producir AAB de prueba (sin firmar de producción aún). Si falla, leer `/tmp/ci-run2.log`.
2. **Autorizar Vercel (device flow):** `vercel login` en background → `https://vercel.com/oauth/device?user_code=XXXX` (el código de hoy expiró; generar nuevo). Necesita un clic del usuario con "Continue with GitHub".
3. **Crear la base Neon Postgres:** probar `vercel storage create neon` con el CLI; si no existe ese comando, crearla desde el dashboard (Vercel → Storage → Neon free) y conectarla al proyecto. Inyecta `DATABASE_URL` (pooler) y `POSTGRES_URL_NON_POOLING`.
4. **Deploy:** `vercel link` + `vercel env add ADMIN_PIN` (= RV669DD2) + `ADMIN_SECRET` + `vercel --prod`. Verificar `/` y `/api/places` con el catálogo sembrado y `/privacidad.html`.
5. **Secrets CI + keystore:** generar keystore con keytool (pass en keystore-backup) → `gh secret set` de `CAP_SERVER_URL` (URL de Vercel), `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS=rutaviva`, `ANDROID_KEY_PASSWORD` → re-disparar workflow → descargar AAB firmado a `~/play-release/`.
6. **Google Play Console** (requiere al usuario): seguir `docs/store-assets/PLAY-CHECKLIST.md` con los assets de `docs/store-assets/` — crear app "RutaViva: Guía de Manzanillo", subir AAB a pruebas internas (cuenta nueva = 12 testers × 14 días), formularios IARC/Seguridad de datos, URL de privacidad (la servirá Vercel en /privacidad.html; aún tiene placeholders `[TU NOMBRE]`/`[correo@de-contacto]` por editar).
7. **Después del lanzamiento:** fotos en la nube (hoy dataURLs), expansión Colima, iOS, extras (ver lista completa en la versión anterior de este roadmap).

> **Notas de sesión (sandbox):** tokens de auth NO persisten entre días — regenerar device codes al retomar. Procesos background sobreviven con `setsid --fork nohup cmd < /dev/null > log 2>&1 &` (nohup simple muere). Flujos OAuth device de GitHub se bloquean con `slow_down` si se encuesta demasiado seguido (usar interval ≥8s y backoff).

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
docs/RAILWAY.md            → plan B de hosting (Railway) para cuando reabra registros
scripts/vercel-build.sh    → build Vercel: switch postgresql + db push + seed + next build
vercel.json                → buildCommand Vercel + header de privacidad.html
www/index.html             → webDir de Capacitor (respaldo del APK; cap sync lo exige)
~/keystore-backup/         → credenciales de producción (PIN, secret, keystore pass)
scripts/daemon.py          → forma correcta de mantener procesos vivos en el sandbox
worklog.md                 → bitácora técnica detallada por tarea
```

---

*Detalle técnico completo de cada tarea en `worklog.md` (Tasks 1–5, verificación E2E incluida).*
