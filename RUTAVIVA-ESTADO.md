# RutaViva · Estado del proyecto (documento de continuidad)

> **Guardado el:** fin de sesión de despliegue — *"guarda todo y mañana continuamos"*
> **Objetivo de este documento:** que cualquier sesión futura retome el proyecto exactamente donde quedó, sin rehacer trabajo.
>
> **⚡ SITUACIÓN ACTUAL (cierre nocturno 2026-10-26):** **PRODUCCIÓN EN LÍNEA** → https://rutaviva-seven.vercel.app (Next 16.1.3 + Neon Postgres iad1 · **14 lugares publicados** · privacidad sin placeholders · admin PIN en envs de Vercel). **AAB + APK DE PRODUCCIÓN VERIFICADOS** (run CI 40160381094, firma keystore real válida a 2056). **APK RECUPERADA DEL CI Y LISTA PARA PROBAR EN EL CELULAR**: descargable en `<URL-preview>/rutaviva.apk` (servida por el dev server; git-ignorada) o por USB — instrucciones entregadas al usuario (incluye aviso Play Protect). **Demo UGC completa ejecutada en vivo** (Task 14 ✓). El sandbox se reinició entre días (26-oct): se perdió el home (play-release/keystore-backup) pero el proyecto, el token GH y el repo sobrevivieron; todo re-descargado del CI. **Mañana: ① usuario prueba la APK en su celular, ② prueba panel admin + limpia demo records, ③ Google Play Console** (guía §4).

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
- **Vercel + Neon: ACTIVO (prod).** Kit pusheado: `scripts/vercel-build.sh` (reescribe datasource a postgresql SOLO en el contenedor de build, prisma generate + db push no destructivo + seed-if-empty + next build; el desarrollo local sigue en SQLite), `vercel.json` (buildCommand + header privacidad), `package.json` con postinstall `prisma generate` + script `vercel-build`. Sin escrituras a disco en runtime (fotos = data URLs en BD) → serverless compatible. Vercel CLI 65.2.0 en el sandbox. Binarios npm globales en `~/.npm-global/bin` (añadir al PATH).
- **Deploy producción (2026-10-25):** https://rutaviva-seven.vercel.app · proyecto Vercel `oroxco/rutaviva` (prj_XbO1kRv2IGWGp5BPG0fRLPaOlRzf) · Neon `neon-charcoal-prism` (iad1) · 3 deploys (el 3° con privacidad real) · seed-if-empty corregido (subproceso) · login admin verificado 200.
- **Keystore producción:** alias `rutaviva`, RSA 2048, 2026→2056 · SHA-256 `C6:4B:2C:D2:0D:1C:05:F6:45:10:E4:2F:AD:49:8A:01:A4:4B:9D:AB:D3:78:48:3C:00:66:9B:B3:FA:0A:D4:A6`. **⚠️ Al reiniciar el sandbox (26-oct) se perdió la copia local** (`~/keystore-backup/`); el keystore vive SOLO en los secrets de GitHub (cifrados, no exportables por API — repo PÚBLICO: jamás exportarlo como artefacto de CI). CI puede seguir firmando sin límite de tiempo. Red de seguridad: al subir el primer AAB, Play App Signing retiene la app key y la upload key pasa a ser reseteable desde Play Console.
- **Credenciales de producción** (archivo `.tmp-auth/produccion-credenciales.txt`, chmod 600, git-ignorado — también muere si el sandbox se reinicia): `ADMIN_PIN=RV•••••• (en envs de Vercel)`, notas del keystore y URLs. El valor del PIN NUNCA en archivos tracked (repo público; verificado por scan).

---

## 3. Acceso y operación

- **URL:** `/` (única ruta; todo es vistas dentro de `src/components/rutaviva/`).
- **PIN del admin (por defecto):** `rutaviva2025` — sobrescribible con env `ADMIN_PIN` (los defaults viven en código porque el boot del sandbox borra `.env`).
- **Servidor dev:** `bun run dev` puerto 3000. **IMPORTANTE en este sandbox:** los procesos lanzados desde tool-calls son segados; usar `scripts/daemon.py` (doble fork + setsid) para mantenerlo vivo.
- **Re-seed demo (idempotente):** `bun prisma/seed.ts`.
- **Servicios comunes (OSM/Overpass):** el sandbox no tiene salida a internet del servidor; el cliente los consulta directo a Overpass (CORS OK) con fallback al proxy `/api/nearby`. En producción con internet real, funcionarán las farmacias/gasolineras/tiendas reales.

---

## 4. Pendiente — Ruta siguiente (orden actualizado tras esta sesión)

**✅ Completado (GitHub + CI + Deploy + AAB):**
1. ~~Repo GitHub + CI AAB~~ ✓ (verde, artefacto con keystore real)
2. ~~Autorizar Vercel~~ ✓ (usuario seforozco-a11y; re-autorizar GitHub vía device flow watcher cuando el token expire)
3. ~~Base Neon~~ ✓ store `neon-charcoal-prism` creada desde el dashboard por el usuario, conectada al proyecto (inyecta DATABASE_URL pooler + POSTGRES_URL_NON_POOLING; CLI/API no lo permiten headless: callback 127.0.0.1)
4. ~~Deploy producción~~ ✓ **https://rutaviva-seven.vercel.app** — envs ADMIN_PIN/ADMIN_SECRET; seed corregido (bug: `await import()` no esperaba la promesa flotante del seed → ahora subproceso; validado con BD temporal); `/api/places` = 13 lugares; admin login 200
5. ~~Secrets CI + keystore~~ ✓ keytool RSA 2048 válido a 2056 (huellas en keystore-backup); secrets `ANDROID_KEYSTORE_B64/PASSWORD`, `ANDROID_KEY_ALIAS=rutaviva`, `ANDROID_KEY_PASSWORD`, `CAP_SERVER_URL=https://rutaviva-seven.vercel.app`; AAB firmado y descargado a `~/play-release/`
6. **Primera tarea del 26-oct (usuario, 5–10 min): probar la APK en su celular.** Tres vías ya explicadas: ① **PWA** (1 min): Chrome → https://rutaviva-seven.vercel.app → "Agregar a pantalla de inicio"; ② **Sideload del APK firmado** (5 min): bajar `<URL-preview>/rutaviva.apk` a la PC (o directo en el teléfono) → transferir por USB (MTP) o WhatsApp/Drive → instalar (permitir "apps desconocidas" para Archivos; Play Protect avisará → "Instalar de todas formas", es normal); misma firma → la versión de Play se instalará encima como actualización; ③ **Pruebas internas de Play** (la oficial, privada) cuando se haga el paso siguiente. APK verificado: 7,321,057 bytes · SHA-256 `8fa60a90…b28c`.
7. **Segunda tarea (5 min): probar el panel admin personalmente** (app → Admin → PIN en envs de Vercel) y **limpiar los 3 registros de demo** del Task 14 si se desea catálogo puro: lugar *"Mirador La Pozahualca"* (APPROVED, ubicación inventada), reseña *"Marisol T."* en Mercado Municipal (APPROVED), *"Prueba Curl"* (REJECTED, ya invisible — solo aparece si se filtra por estado). Todo borrable desde Admin → Lugares (eliminar).
8. **Google Play Console** (requiere al usuario): seguir `docs/store-assets/PLAY-CHECKLIST.md` — crear app "RutaViva: Guía de Manzanillo", AAB desde Actions run 40160381094 (artefacto `rutaviva-android`, usar `bundle/release/app-release.aab`; re-descargable, ver nota de sandbox abajo), privacidad `https://rutaviva-seven.vercel.app/privacidad.html` (YA sin placeholders), pruebas internas (cuenta personal nueva = 12 testers × 14 días en CERRADAS para producción; internas = hasta 100 testers sin espera), IARC/Seguridad de datos con las respuestas del checklist §C.
9. **Después del lanzamiento:** fotos en la nube (hoy dataURLs), expansión Colima, iOS, extras.

> **Notas de sesión (sandbox):** tokens de auth NO persisten entre días — regenerar device codes al retomar. Procesos background sobreviven con `setsid --fork nohup cmd < /dev/null > log 2>&1 &` (nohup simple muere). Flujos OAuth device de GitHub se bloquean con `slow_down` si se encuesta demasiado seguido (usar interval ≥8s y backoff).
> **⚠️ Reinicio del sandbox 26-oct:** el directorio home fue limpiado (se perdieron `~/play-release/`, `~/keystore-backup/`, Vercel CLI), pero el proyecto, `.tmp-auth/` (token GH vigente) y el repo sobrevivieron. `gh` CLI NO está instalado → usar `curl` + REST API con `GH_TOKEN=$(cat .tmp-auth/gh-token)`. **Re-descargar APK/AAB del CI:** artefacto 12586187151 (run 40160381094, expira 2027-01-23) → `curl -sL -H "Authorization: Bearer $GH_TOKEN" -o art.zip https://api.github.com/repos/seforozco-a11y/rutaviva/actions/artifacts/12586187151/zip && unzip art.zip` → copiar APK a `public/rutaviva.apk` para volver a servirlo. Si el token GH expiró: reactivar watcher `.tmp-auth/gh-watch.sh` (device flow). Vercel CLI: reinstalar solo si se necesita redeploy (`bunx vercel login`).

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
.tmp-auth/                 → credenciales de producción + token GH (git-ignorado; muere si el sandbox se reinicia)
public/rutaviva.apk        → APK firmado servido para sideload (git-ignorado; re-descargar del CI si falta)
scripts/daemon.py          → forma correcta de mantener procesos vivos en el sandbox
worklog.md                 → bitácora técnica detallada por tarea
```

---

*Detalle técnico completo de cada tarea en `worklog.md` (Tasks 1–5, verificación E2E incluida).*
