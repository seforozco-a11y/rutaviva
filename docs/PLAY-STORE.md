# RutaViva · Guía para publicar en Google Play Store

> **App:** RutaViva — Guía turística de Manzanillo, Colima, México (Next.js 16 / PWA envuelta con Capacitor)
> **appId Android:** `com.rutaviva.colima` · **appName:** `RutaViva`
> **Documento operativo:** sigue las secciones en orden. Los puntos marcados con ⚠️ deben verificarse en la consola actual (los requisitos de Google Play cambian con frecuencia) porque esta guía fue escrita sin acceso a web-search en el momento de redactarla.

---

## 0. Resumen de la ruta de publicación

```
App web / PWA (Next.js 16, src/app + src/components/rutaviva/)
        │
        ▼
Proyecto Capacitor  (carpeta android/ dentro del repo)
   appId: com.rutaviva.colima · appName: RutaViva
        │
        ▼
GitHub Actions  (workflow .github/workflows/android-build.yml)
   compila web → sincroniza Capacitor → Gradle assemble/bundle
        │
        ▼
AAB firmado (artefacto descargable del run de Actions)
        │
        ▼
Google Play Console
   Pruebas internas → Pruebas cerradas → Producción
```

**Idea clave:** el AAB es la "cáscara" Android de la app. El contenido real (mapa, lugares, reseñas, panel admin) vive en el backend Next.js con su base de datos, que **debe estar desplegado en internet con HTTPS** (sección 2.5). El APK/AAB carga esa URL desde el secret `CAP_SERVER_URL`.

**Idea clave #2:** Play exige para apps con contenido de usuarios (UGC) moderación, mecanismo de reporte y reglas visibles. RutaViva **ya las cumple** (tabla de la sección 5), incluido el botón **"Reportar"** en cada reseña y la **cola de reseñas reportadas** en el panel admin (Task 7-c).

---

## 1. Requisitos previos

### 1.1 Cuenta de Google Play Developer

- Regístrate en <https://play.google.com/console> con una cuenta de Google.
- **Costo:** tarifa única de registro de **US$25** (pago no recurrente).
- **Verificación de identidad:** Google pedirá documents de identidad y, si aplica, datos fiscales/bancarios (para cobrar, aunque RutaViva sea gratuita). ⚠️ *Verificar los documentos exactos que pide la consola actual.*

### 1.2 Cuenta personal vs. organizacional (MUY importante para RutaViva)

| Tipo de cuenta | Requisito para publicar en producción (apps de consumidor) | Recomendación |
|---|---|---|
| **Personal (nueva)** — creada después de nov. 2023 | Antes de poder solicitar acceso a producción, la app debe pasar **pruebas cerradas con al menos 12 testers durante 14 días continuos**, y luego aplicar al programa de acceso a producción. | Camino válido pero lento: hay que reclutar 12+ personas reales con dispositivos Android y esperar 2+ semanas. |
| **Organizacional** (empresa, asociación, con D-U-N-S de Dun & Bradstreet si Google lo pide) | **No requiere** las pruebas cerradas de 12 testers × 14 días para acceder a producción. | Camino más rápido si RutaViva se publica bajo una marca/organización (ej. "RutaViva Colima"). |

Detalles a verificar en la consola actual: ⚠️ número exacto de testers y días vigentes, ⚠️ cómo obtiene una organización mexicana su número D-U-N-S (gratuito, tarda hasta 30 días), ⚠️ si la cuenta ya existía antes de nov. 2023 (esas cuentas antiguas no están sujetas a la regla).

**Si vas por la ruta personal (12 testers):** prepara una lista con correo Gmail de 12–20 testers (familia, amigos, viajeros locales de Manzanillo). Los agregarás a la prueba cerrada (sección 6.2). ⚠️ *Confirmar en la consola si el requisito pide "12" exactos o "20"; los anuncios de Google han mencionado ambas cifras según el año.*

### 1.3 Lo que necesitas tener antes de empezar

1. ✅ El código de RutaViva (este repo) con la carpeta `android/` ya generada.
2. ✅ Backend desplegado en HTTPS (sección 2.5) — sin esto la app publicada estará vacía.
3. ⬜ Una **política de privacidad pública en una URL** (requisito obligatorio de Play para TODAS las apps). Sugerencia: una página `/privacidad` simple en el mismo backend desplegado, o un documento alojado (Google Docs publicado / Notion). RutaViva no tiene anuncios ni SDKs de terceros, así que la política es sencilla: recoge nombre mostrado, reseñas, fotos y ubicación GPS para ordenar resultados; datos guardados en el backend propio; sin publicidad; solicitudes de borrado al correo de contacto.
4. ⬜ Un **correo de contacto** público (ej. `contacto@rutaviva.mx`) para la ficha y para solicitudes de borrado de datos.
5. ⬜ **Keystore de producción** generado y subido a los secrets de GitHub (sección 2.4).
6. ⬜ **Cambiar el PIN del admin por defecto** (`rutaviva2025`) antes de publicar — ver nota al final de la sección 5.

---

## 2. Preparar el repo y el build con CI

### 2.1 Subir el proyecto a GitHub

```bash
# dentro de /home/z/my-project (raíz del repo RutaViva)
git init
git add .
git commit -m "RutaViva: versión lista para Play Store"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rutaviva.git
git push -u origin main
```

Notas:

- Crea primero el repositorio vacío en <https://github.com/new> (privado o público; para compilar con Actions, un repo **privado** funciona igual y protege el código).
- Añade un `.gitignore` que excluya `node_modules/`, `.next/`, `db/*.db`, `*.jks`, `*.keystore` y `android/.gradle/` — **el keystore JAMÁS debe subirse al repo, solo a los secrets de GitHub**.
- Verifica en GitHub → *Settings* → *Actions* → *General* → *Workflow permissions* que los workflows puedan subir artefactos (por defecto sí, con permisos de lectura).

### 2.2 El workflow `.github/workflows/android-build.yml` explicado

El repo ya incluye el workflow en `.github/workflows/android-build.yml`. Su comportamiento:

1. **Disparo:** se ejecuta con cada push a `main` (y se puede disparar manualmente desde la pestaña *Actions* → *Android Build* → *Run workflow*; si el trigger del archivo cambió, ajústalo ahí).
2. **Pasos del job:** instala dependencias (bun/npm), compila la parte web de Next.js, sincroniza Capacitor (`npx cap sync android`), y ejecuta Gradle (`assembleRelease` / `bundleRelease`) dentro de `android/`.
3. **Firma:** usa los secrets del keystore si existen; si no, **genera un keystore temporal SOLO para pruebas**.
4. **Artefacto:** sube el resultado como artefacto del run (`app-release.aab` y/o `app-release.apk`).

**Secrets que consume** (configúralos en GitHub → *Settings* → *Secrets and variables* → *Actions*):

| Secret | Obligatorio | Qué es |
|---|---|---|
| `CAP_SERVER_URL` | Opcional en el workflow, **en la práctica imprescindible** | URL **https pública** donde está desplegado el backend Next.js (ej. `https://rutaviva.vercel.app`). El APK/AAB carga esa URL en su WebView: mapa, reseñas, panel admin y fotos vienen de ahí. Sin este valor, el build sirve solo para pruebas locales. |
| `ANDROID_KEYSTORE_B64` | Para producción | El keystore `.jks` de producción **codificado en base64** (sección 2.4). Si NO se define, el CI genera un keystore temporal — sirve únicamente para builds de prueba, **no publicar ese AAB en producción**. |
| `ANDROID_KEYSTORE_PASSWORD` | Para producción | Contraseña del keystore (la que pusiste al crearlo con keytool). |
| `ANDROID_KEY_ALIAS` | Para producción | Alias de la clave dentro del keystore (ej. `rutaviva`). |
| `ANDROID_KEY_PASSWORD` | Para producción | Contraseña de la clave (puede ser la misma que la del keystore). |

> 💡 **Regla de oro:** usa el keystore temporal solo para las pruebas internas de instalación. **Antes del primer envío a producción, sube los 4 secrets del keystore real** (sección 2.4). Si publicas producción con la clave temporal, esa clave queda enrolada como "upload key" en Play App Signing y cambiarla después solo es posible por gestión con Soporte de Google. ⚠️ *Confirmar en la consola el proceso de reset de upload key.*

### 2.3 Descargar el artefacto AAB/APK del workflow

1. Ve a GitHub → tu repo → pestaña **Actions**.
2. Entra al run más reciente (o dispara uno con *Run workflow*).
3. Espera el check verde ✔ (los errores típicos: secrets mal pegados con espacios, o `CAP_SERVER_URL` sin `https://`).
4. Baja a la sección **Artifacts** del run y descarga el ZIP (ej. `android-release`).
5. Descomprime: dentro estarán `app-release.aab` (para Play Store) y `app-release.apk` (para instalar directo en un celular de prueba).

Para instalar el APK de prueba en un dispositivo:

```bash
adb install app-release.apk
```

### 2.4 Generar el keystore de producción localmente (keytool)

El keystore contiene la clave con la que firmas tus versiones. **Pérdelo = pierdes la capacidad de actualizar la app.** Guárdalo en un lugar seguro (copia de seguridad fuera de la laptop) y **no lo subas al repositorio**.

```bash
# Requiere el JDK (viene con Android Studio) — keytool está en el PATH del JDK
keytool -genkeypair -v \
  -keystore rutaviva-upload.jks \
  -alias rutaviva \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype JKS
```

Te preguntará:

- **Contraseña del almacén** → será `ANDROID_KEYSTORE_PASSWORD` (usa la misma para la clave = `ANDROID_KEY_PASSWORD`, mínimo 6 caracteres; idealmente fuerte).
- **Nombre y apellidos / unidad / organización** → ej. `RutaViva`, organización `RutaViva Colima`, ciudad `Manzanillo`, estado `Colima`, país `MX` (dos letras).
- Validez 10000 días ≈ 27 años (requisito práctico de Play: que venza después de oct. 2033). ⚠️ *Verificar la fecha mínima de validez vigente.*

**Codificarlo a base64** (los secrets de GitHub no aceptan archivos binarios, por eso existe `ANDROID_KEYSTORE_B64`):

```bash
# Linux
base64 rutaviva-upload.jks > rutaviva-upload.b64

# macOS
base64 -i rutaviva-upload.jks -o rutaviva-upload.b64

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("rutaviva-upload.jks")) > rutaviva-upload.b64
```

Sube los secrets en GitHub (*Settings* → *Secrets and variables* → *Actions* → *New repository secret*):

- `ANDROID_KEYSTORE_B64` → **contenido completo** del archivo `rutaviva-upload.b64`.
- `ANDROID_KEYSTORE_PASSWORD` → la contraseña del almacén.
- `ANDROID_KEY_ALIAS` → `rutaviva`.
- `ANDROID_KEY_PASSWORD` → la contraseña de la clave.

Verificación opcional de que el base64 es correcto:

```bash
base64 -d rutaviva-upload.b64 > /tmp/check.jks
keytool -list -keystore /tmp/check.jks   # debe pedir la contraseña y mostrar el alias "rutaviva"
```

Haz un push a `main` para que el CI regenere el AAB **ya firmado con la clave de producción**.

### 2.5 ⚠️ IMPORTANTE: el AAB necesita el backend desplegado con HTTPS

La app Android es un contenedor (WebView de Capacitor) que carga la web app **remota**. Si el backend Next.js (con su base de datos y el panel admin) no está en una URL pública HTTPS, la app publicada no tendrá datos: ni mapa, ni lugares, ni reseñas, ni moderación.

**Qué debe quedar funcionando en el hosting:**

- La web app en `/` (splash, mapa, reseñas, guía, admin).
- Las APIs: `/api/places`, `/api/places/[id]`, `/api/reviews`, `/api/nearby`, `/api/admin/*`.
- Variables de entorno de producción: `DATABASE_URL`, `ADMIN_PIN` (¡nuevo PIN!), `ADMIN_SECRET`.
- El **re-seed inicial** de los 13 lugares de Manzanillo (`prisma/seed.ts`) si arrancas con base de datos nueva.

**Opción A — Vercel + Postgres (Neon / Supabase / Vercel Postgres) — la más simple:**

1. Crea la base de datos Postgres (ej. en <https://neon.tech> o <https://supabase.com>, plan gratuito) y copia la *connection string*.
2. Sube el repo a Vercel (<https://vercel.com> → *Add New Project* → importa el repo de GitHub).
3. En Vercel → *Settings* → *Environment Variables*:
   - `DATABASE_URL` = la connection string Postgres (con `?sslmode=require`; si usas pooling de Supabase, el puerto 6543 con `?pgbouncer=true`, y declara además `DIRECT_URL` al puerto 5432 para migraciones).
   - `ADMIN_PIN` = el PIN nuevo (NO `rutaviva2025`).
   - `ADMIN_SECRET` = una cadena aleatoria larga (firma la cookie de admin).
4. **Migrar Prisma de SQLite a Postgres** (Prisma cambia el provider, el resto del esquema se mantiene igual):

   ```prisma
   // prisma/schema.prisma — cambiar SOLO el provider
   datasource db {
     provider = "postgresql"          // antes: "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

   ```bash
   # Crear el esquema en la base remota
   DATABASE_URL="postgresql://usuario:password@host:5432/rutaviva?sslmode=require" \
     npx prisma db push

   # Poblar con los 13 lugares de Manzanillo (reseñas demo incluidas)
   DATABASE_URL="postgresql://usuario:password@host:5432/rutaviva?sslmode=require" \
     bun prisma/seed.ts
   ```

   Notas de esta migración:
   - Los modelos `SingularPlace`, `Review` y `Photo` no cambian; solo el `provider`.
   - Las fotos viajan como dataURL/texto en la BD — funciona igual en Postgres. Para escalar, el plan del proyecto es moverlas a Firebase Storage / Cloudinary / S3 (ya está en la ruta siguiente del proyecto; no bloquea el lanzamiento con poco volumen).
   - Asegúrate de que el build de Vercel ejecute `prisma generate` antes de `next build` (p. ej. agregando `"postinstall": "prisma generate"` en `package.json` — es un cambio de una línea que hace falta hacer en el repo antes de desplegar).
5. Despliega, abre `https://tu-proyecto.vercel.app` y verifica: mapa con lugares, envío de una reseña (queda PENDING), login de admin con el PIN nuevo.

**Opción B — Railway (<https://railway.app>):**

1. *New Project* → despliega desde el repo de GitHub → añade el plugin **PostgreSQL** (Railway crea `DATABASE_URL` automáticamente).
2. Aplica el mismo cambio de provider a `"postgresql"` y corre `npx prisma db push` + seed desde un shell de Railway o localmente apuntando a la URL remota.
3. Define `ADMIN_PIN` y `ADMIN_SECRET` en *Variables*. Railway te da dominio HTTPS generado (o conecta tu dominio).

**Opción C — VPS (Hetzner / DigitalOcean / tu hosting):**

1. Servidor Ubuntu + Node 20+ y (opcional) Postgres local, o SQLite con **volumen persistente** (SQLite sirve si solo hay un proceso servidor y haces backups del archivo `db/custom.db`).
2. `bun run build` y arranca el server standalone (`NODE_ENV=production bun .next/standalone/server.js`) como servicio systemd.
3. HTTPS con **Caddy** — el repo ya incluye un `Caddyfile`; Caddy emite certificados Let's Encrypt automáticamente con solo apuntar tu dominio DNS al VPS.

Una vez desplegado, pon esa URL en el secret `CAP_SERVER_URL` (sección 2.2) y dispara el build: el AAB cargará el backend real.

---

## 3. Ficha de Play Store (store listing)

Consola: <https://play.google.com/console> → tu app → **Crecimiento → Store presence → Ficha principal de Play Store**. Idioma principal recomendado: **Español (México)**.

### 3.1 Título (máx. 30 caracteres)

```
RutaViva: Guía de Manzanillo
```
*(28 caracteres ✔)*

### 3.2 Descripción corta (máx. 80 caracteres)

```
Explora Manzanillo: playas, miradores, servicios y reseñas con mapa GPS.
```
*(72 caracteres ✔)*

### 3.3 Descripción completa (máx. 4000 caracteres) — lista para copiar/pegar

```
RutaViva es tu guía turística para descubrir Manzanillo, Colima, como un local. 🌊

🗺️ TODO EN UN MAPA, A TU MEDIDA
Abre la app, deja que el GPS te ubique y mira al instante los lugares singulares más cercanos, ordenados por distancia real: playas, miradores, monumentos, gastronomía, museos y plazas. Toca una tarjeta y conoce el lugar: foto, descripción, tips de viajero y "Cómo llegar" con una sola pulsación.

🏖️ LOS LUGARES QUE HACEN ÚNICO A MANZANILLO
• Playas: La Audiencia, Miramar, Salahua, Santiago, La Boquita, Ventanas y Carrizales
• Mirador de la Bahía de Santiago, el Monumento al Pescador y el famoso Monumento del Pez Vela junto a la Plaza Benito Juárez
• Centro Histórico y Malecón, Mercado Municipal
• El Tortugario de Cuyutlán y el Museo de la Sal

🧭 SERVICIOS CERCA DE TI
¿Necesitas una farmacia, gasolinera, cajero o tienda de conveniencia? RutaViva también te muestra los servicios comunes alrededor, con datos abiertos de OpenStreetMap.

⭐ RESEÑAS Y FOTOS DE VIAJEROS, CON CONTROL DE CALIDAD
Escribe reseñas con calificación de estrellas y comparte hasta 3 fotos. Para proteger a la comunidad, todo lo que envían los usuarios (reseñas, fotos y sugerencias de lugares) pasa por revisión de nuestro equipo antes de publicarse, bajo formatos y principios claros. ¿Viste algo inapropiado? Usa el botón "Reportar" de cualquier reseña y nuestro equipo lo atenderá.

🙋 SUGIERE EL LUGAR QUE FALTA
¿Tu playa o tu puesto favorito no aparece? Sugiérelo desde la app; si cumple los formatos, lo publicamos con crédito a tu nombre.

🚫 SIN ANUNCIOS. GRATIS.
RutaViva es gratuita y no muestra publicidad.

📍 DISPONIBLE HOY EN MANZANILLO, PRONTO EN TODO COLIMA
Empezamos en el gran puerto del Pacífico Mexicano y vamos sumando municipio por municipio los 10 del estado de Colima.

Descarga RutaViva y déjate llevar por la ruta. 🚗🏖️
```
*(≈1,840 caracteres — cabe holgado en el límite de 4,000; evita repetir palabras clave en exceso, que Play penaliza el keyword stuffing. Nota: reseñas permiten máx. 3 fotos (limit real de la app); no prometas 5 en la ficha.)*

### 3.4 Gráficos requeridos

| Elemento | Especificación | Cómo hacerlo para RutaViva |
|---|---|---|
| **Capturas de teléfono** | Mínimo **2** (recomendado 4–8). JPEG o PNG de 24 bits; lado mínimo 320 px, lado máximo 3840 px; relación de aspecto máxima 2:1. Recomendado **1080×1920** o **1080×2340**. ⚠️ *Verificar especificaciones vigentes en la consola.* | Ver 3.5 abajo. |
| **Ícono de la app** | **512×512 PNG de 32 bits** (con transparencia). | El proyecto ya lo tiene: `public/icon-512.png` (derivado de `public/icon-1024.png`). Súbelo tal cual. |
| **Gráfico de promoción (feature graphic)** | **1024×500** JPG o PNG **sin transparencia**. | Hay que crearlo: la imagen actual `public/hero-manzanillo.png` es vertical (768×1344), no sirve tal cual. Receta: usa la imagen aérea de la bahía como fondo recortado en franja horizontal 1024×500, superpón el logo/ícono a la izquierda y el texto *"Tu guía de Manzanillo"* + badge *"Disponible hoy en Manzanillo, Colima"*. Puedes hacerlo con Canva, Figma o el propio editor de imágenes del sistema. |

### 3.5 Cómo tomar las capturas de pantalla (vistas sugeridas)

**Con emulador (recomendado, salida limpia):** Android Studio → *Device Manager* → crea un Pixel con resolución 1080×1920 o 1080×2340 → abre la app (instala el APK del CI o corre la PWA en Chrome del emulador) → navega a cada vista → captura con el botón de cámara del emulador. Las capturas se guardan en la carpeta de capturas del sistema/emulador.

**Con dispositivo real:**

```bash
adb exec-out screencap -p > captura.png
```

**Vistas sugeridas (en este orden):**

1. **Portada / splash** — imagen aérea de la bahía con el badge *"Disponible hoy en Manzanillo, Colima"* (`src/components/rutaviva/splash.tsx`). Es la cara de la app.
2. **Mapa con franja de tarjetas** — mapa Leaflet con marcadores y la franja ordenada por distancia, idealmente con la Playa Santiago o el Centro Histórico cerca (`map-view.tsx`).
3. **Detalle con reseñas** — bottom-sheet del detalle con foto, rating y reseñas de viajeros con sus fotos (`place-detail-sheet.tsx`).
4. **Panel Guía** — stats reales, roadmap *"De Manzanillo a todo Colima"* y *"¿Cómo funciona la publicación?"* (`about-panel.tsx`). Comunica confianza/moderación.
5. *(Opcional)* **Escribir reseña** (muestra estrellas + fotos) y **Sugerir un lugar**.

Tip: en la app de demo hay datos sembrados (`bun prisma/seed.ts`) — usa ese estado para que las capturas se vean vivas y con fotos reales de Manzanillo.

### 3.6 Categoría y clasificación comercial

- **Categoría:** *Viajes y guías locales* (Travel & Local). Etiquetas/tags sugeridos: Manzanillo, Colima, playas, guía turística, México.
- **¿Contiene anuncios?** → **No**. RutaViva no tiene ningún SDK de publicidad. Declara "Sin anuncios" en la ficha y en el formulario correspondiente de *Contenido de la app*.
- Tipo: **Aplicación** · **Gratuita** (no hay pagos dentro de la app).

---

## 4. Formularios obligatorios de Play Console

Sección **Política → Contenido de la app** (App content) de la consola. Rellénalos en orden; hasta que no estén completos, Play no permite subir a producción.

### 4.1 Política de privacidad (obligatoria)

- URL pública de tu política (sección 1.3, punto 3). Debe describir: qué datos recoge la app (nombre mostrado, reseñas, fotos, ubicación GPS), que se almacenan en el backend propio de RutaViva, que no se usan para publicidad ni se comparten con terceros comerciales, y el correo para solicitar borrado.
- Menciona también que los datos de servicios comunes provienen de OpenStreetMap/Overpass (el mapa consulta esos servicios abiertos con el área visible).

### 4.2 Clasificación de contenido (cuestionario IARC)

Cuestionario de ~30 preguntas sobre violencia, sexo, drogas, apuestas, etc. Para RutaViva:

- Contenido: guía turística con textos y fotos de lugares; **no** hay violencia, sexo, apuestas, drogas ni compra de bienes.
- **Contenido generado por usuarios:** responde con honestidad que **sí** los usuarios pueden compartir contenido (reseñas y fotos) y que **sí** existe moderación previa a la publicación y mecanismo de reporte — la consola lo pregunta explícitamente.
- Resultado esperado: **"Todos" / Para mayores de 3 años** (sin contenido restringido). ⚠️ *La clasificación final la calcula IARC; verificar el resultado tras el cuestionario.*

### 4.3 Declaración de Seguridad de datos (Data safety)

Punto crítico: declara qué datos **recoge** (transmite fuera del dispositivo) la app. RutaViva recoge lo siguiente, todo hacia el **backend propio** (sin terceros publicitarios):

| Pregunta del formulario | Respuesta para RutaViva |
|---|---|
| ¿Tu app recopila o comparte alguno de los tipos de datos requeridos? | **Sí** |
| **Ubicación → Precisa** (GPS en tiempo real para ordenar por distancia) | Recopilada: **Sí** · Compartida: **No** · Procesada efímeramente: **No** (se usa en la consulta y no se persiste como perfil) · Requerida/Opcional: **Opcional** (si el usuario niega el GPS, la app usa ubicación demo) · Cifrada en tránsito: **Sí** (HTTPS) · Propósito: **Funcionalidad de la app** |
| **Información personal → Nombre** (nombre mostrado en las reseñas) | Recopilada: **Sí** · Compartida: **No** · Cifrada en tránsito: **Sí** · Propósito: **Funcionalidad de la app** |
| **Fotos y videos → Fotos** (fotos adjuntas a reseñas y sugerencias) | Recopilada: **Sí** · Compartida: **No** · Cifrada en tránsito: **Sí** · Propósito: **Funcionalidad de la app** |
| **Actividad en la app → Otros contenidos generados por el usuario** (texto de reseñas/comentarios y sugerencias de lugares) | Recopilada: **Sí** · Compartida: **No** · Cifrada en tránsito: **Sí** · Propósito: **Funcionalidad de la app** |
| ¿Los datos se usan para publicidad o marketing? | **No** (no hay SDKs de anuncios ni de analítica de terceros) |
| ¿Todos los usos declarados cumplen las Políticas de datos del usuario y el Uso seguro de datos? | **Sí** |
| ¿Ofreces forma de solicitar el borrado de datos? | **Sí** — vía correo de contacto (el admin puede eliminar reseñas/fotos/lugares desde el panel). ⚠️ *Definir el mecanismo exacto antes de responder.* |

Notas: la cookie de sesión del administrador (`rv_admin`, httpOnly firmada) solo aplica al equipo editorial, no es un dato de usuarios finales. La app **no recopila** identificadores de dispositivo ni usa analítica de terceros. ⚠️ *Las categorías exactas del formulario cambian; usa la que corresponda a "contenidos generados por el usuario" en la consola actual.*

### 4.4 Público objetivo

- Grupo de edad objetivo: **13 años o más** (selecciona los rangos que correspondan; **no** marques "dirigida a menores de 13"). Así se evita el programa *Familias* y sus requisitos extra. La app es una guía general de viajes.
- Declaraciones sobre si la app atrae deliberadamente a niños: responde **No** (es una guía general de viajes, no dirigida a menores).

### 4.5 Otros formularios de la misma sección

- **Anuncios:** *No, mi app no contiene anuncios*.
- **Acceso a la app (App access):** todas las funciones para usuarios finales son libres. Si la consola lo pide, indica que existe un panel administrativo con PIN solo para el equipo editorial y, si lo solicitas, proporciona un **PIN de demostración** (nunca el PIN de producción).
- **Apps de noticias / COVID / gobierno / funciones financieras:** responde **No** en todos los casos. ⚠️ *Verificar la lista vigente de declaraciones en la consola.*
- **Contenido UGC (si la consola muestra la declaración específica):** confirma que la app cumple moderación + reporte + remoción + reglas visibles — la tabla de la sección 5 es tu evidencia.

---

## 5. Cumplimiento de la política UGC de Play → implementación en RutaViva

La política de Contenido generado por los usuarios (UGC) de Google Play exige, como mínimo: moderación, mecanismo de reporte/apelación, capacidad de remover contenido y reglas de publicación visibles. RutaViva las cumple **por diseño** (no son promesas futuras):

| # | Requisito de la política UGC de Google Play | Implementación en RutaViva | Estado |
|---|---|---|---|
| 1 | **Contenido generado por usuarios debe pasar por moderación** antes de ser visible | Reseñas, fotos y sugerencias de lugares se guardan con `status PENDING` y **no son visibles** en la app; solo el administrador las publica (`status APPROVED`) desde el panel admin, validándolas con el **checklist de formatos** (nombre, descripción ≥30, categoría, ubicación, foto). Backend: `src/lib/server/moderation.ts`, APIs `POST /api/reviews`, `POST /api/places` (crea PENDING), `PATCH /api/admin/reviews/[id]` y `/api/admin/places/[id]`. UI: `src/components/rutaviva/admin/admin-panel.tsx` con dialog "Validar y publicar". | ✅ |
| 2 | **Mecanismo de reporte/apelación dentro de la app** | Botón **"Reportar"** en cada reseña del detalle del lugar + **cola de reseñas reportadas** en el panel admin para atenderlas (rechazar/eliminar o desestimar). *(Feature añadida en Task 7-c.)* El correo de contacto sirve como canal de apelación externo. | ✅ |
| 3 | **Capacidad de remover contenido inapropiado** | El admin puede **rechazar** (`REJECTED`, deja de ser visible) o **eliminar definitivamente** reseñas y lugares desde el panel admin (`PATCH`/`DELETE /api/admin/reviews/[id]` y `/api/admin/places/[id]`); las fotos de una reseña rechazada se ocultan junto con ella. | ✅ |
| 4 | **Reglas de publicación visibles para los usuarios** | "Formatos y principios" del proyecto: el **checklist de validación** que se muestra al administrador y la sección **"¿Cómo funciona la publicación?"** en el panel Guía (`about-panel.tsx`: viajero → equipo → app). Además, al enviar una reseña o sugerencia, la app avisa *"Tu reseña está en revisión"* / *"Sugerencia enviada"*, dejando claro que nada se publica directo. | ✅ |
| 5 | **Declaración de UGC en Play Console y política de privacidad** | Formulario de contenido UGC + Seguridad de datos (sección 4) con la evidencia de las filas 1–4; URL de política de privacidad en la ficha. | ⚠️ Al publicar |

> **🔴 NOTA CRÍTICA ANTES DE PUBLICAR:** el PIN del administrador por defecto es `rutaviva2025` (está como default en el código, sobrescribible con la variable de entorno `ADMIN_PIN`). **Cámbialo en el hosting de producción** (variable `ADMIN_PIN`) antes de subir el AAB a producción; con el PIN por defecto, cualquiera que conozca el proyecto podría aprobar contenido. Verifica también que `ADMIN_SECRET` sea una cadena aleatoria larga.

---

## 6. Subir el primer AAB y publicar

### 6.1 Crear la app en Play Console

1. <https://play.google.com/console> → **Crear app**.
2. Datos: nombre **`RutaViva: Guía de Manzanillo`**, idioma predeterminado **Español (México)**, tipo **Aplicación**, modelo **Gratuita**. Acepta las declaraciones y crea.
3. Completa los formularios de la sección 4 (política de privacidad, clasificación, seguridad de datos, público objetivo, anuncios) y la ficha de la sección 3.

### 6.2 Ruta recomendada de lanzamiento

**Paso 1 — Pruebas internas (rápidas, hasta 100 testers):**

- Consola → **Pruebas → Pruebas internas** → crear versión → **subir el `app-release.aab`** descargado del CI → notas de la versión → lista de correos de testers (o Google Group) → enviar el **enlace de participación (opt-in)** a tu equipo.
- En minutos el AAB está instalable para los testers. Verifica: GPS real en Manzanillo, mapa, reseña PENDING, botón "Reportar", panel admin con el PIN nuevo.

**Paso 2 — Pruebas cerradas (obligatorio si tu cuenta es personal nueva):**

- Consola → **Pruebas → Pruebas cerradas** → crear la versión cerrada (puede ser el mismo AAB) y añadir **≥12 testers** por lista de correos.
- Mantén la prueba **activa y con testers reales durante 14 días continuos**, con algo de actividad (instalaciones y uso). ⚠️ *Confirmar el criterio exacto que la consola evalúa para habilitar el acceso a producción.*
- Después solicita el **acceso a producción** (el formulario pide información de la prueba: número de testers, plan de pruebas, categoría). Responde con: guía local de Manzanillo, moderación UGC completa, pruebas cerradas con 12–20 viajeros reales.

**Paso 3 — Producción:**

- Consola → **Producción → Crear nueva versión** → subir el **mismo AAB firmado con el keystore real** (los secrets de la sección 2.4 ya configurados) → notas de la versión (ej. *"Primera versión pública: guía de Manzanillo con mapa GPS, reseñas moderadas y reporte de contenido"*) → **Revisión y lanzamiento** → iniciar publicación al 100 % (o lanzamiento por fases: 10 % → 50 % → 100 %).
- La revisión de Google suele tardar de horas a pocos días para apps nuevas con UGC. ⚠️ *Los tiempos actuales de revisión varían; consulta el estado en la consola.*
- Cuando Play inscribe tu app en **Play App Signing** (automático en el primer envío), tu keystore queda como *upload key*: guárdalo, es la firma de todas tus futuras versiones.

### 6.3 VersionCode / VersionName: cómo incrementar en cada actualización

Están en **`android/app/build.gradle`** (bloque `defaultConfig`):

```gradle
defaultConfig {
    applicationId "com.rutaviva.colima"
    versionCode 1        // ← entero que SIEMPRE sube (1, 2, 3…)
    versionName "1.0.0"  // ← versión visible a usuarios (semántica)
}
```

Rutina para cada actualización:

1. Cambia el código de la web app (reseñas, lugares, etc.) y el del backend; despliega el backend primero.
2. Edita `android/app/build.gradle`: `versionCode` **+1** (Play rechaza reenvíos con el mismo código: *"Ya existe una versión con el código X"*) y `versionName` según el cambio (`1.0.1` fix, `1.1.0` feature).
3. `git commit` + `git push` → GitHub Actions genera el nuevo AAB → descárgalo (sección 2.3).
4. Súbelo al track correspondiente (internas/cerradas/producción) con notas de versión.

> 💡 Si solo cambian datos del backend (nuevos lugares, reseñas) **no hace falta** nueva versión del AAB: la app carga todo desde `CAP_SERVER_URL`. Nueva versión de AAB solo cuando cambie la cáscara Android (config de Capacitor, plugins, permisos nativos, ícono, versión).

---

## 7. Checklist final imprimible

### Preparación
- [ ] Cuenta de Google Play Developer creada y verificada (US$25 pagados).
- [ ] Decidida la vía: organizacional (sin cuarentena) o personal (pruebas cerradas 12 testers × 14 días). ⚠️
- [ ] Correo de contacto público y política de privacidad publicada en una URL.
- [ ] PIN de admin cambiado en producción (`ADMIN_PIN` ≠ `rutaviva2025`) y `ADMIN_SECRET` aleatorio.

### Backend y build
- [ ] Backend Next.js desplegado con HTTPS (Vercel/Neon/Supabase, Railway o VPS) y dominio funcionando.
- [ ] Prisma migrado a `postgresql` (si aplica) + `prisma db push` + seed de los 13 lugares de Manzanillo.
- [ ] Variables en el hosting: `DATABASE_URL`, `ADMIN_PIN`, `ADMIN_SECRET`.
- [ ] Repo subido a GitHub con `.gitignore` (sin `.jks`, sin `db/*.db`).
- [ ] Secrets en GitHub Actions: `CAP_SERVER_URL`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- [ ] Keystore de producción generado con keytool, en base64 y con copia de seguridad segura.
- [ ] Run de Actions en verde y AAB descargado, firmado con el keystore real.

### Ficha de Play Store
- [ ] Título: `RutaViva: Guía de Manzanillo` (≤30 car.).
- [ ] Descripción corta (≤80) y descripción completa (≤4000) pegadas.
- [ ] ≥2 capturas de teléfono 1080×1920/2340 (splash, mapa con franja, detalle con reseñas, Guía).
- [ ] Ícono 512×512 PNG (`public/icon-512.png`).
- [ ] Gráfico de promoción 1024×500 sin transparencia (crear desde la imagen de la bahía).
- [ ] Categoría: Viajes y guías locales · Sin anuncios · Gratuita.

### Formularios de Play Console
- [ ] Política de privacidad (URL) registrada.
- [ ] Clasificación de contenido (IARC) completada; UGC respondido con moderación + reporte.
- [ ] Seguridad de datos: ubicación precisa, nombre, fotos, contenidos de usuario — recopilados, no compartidos, HTTPS.
- [ ] Público objetivo: 13+.
- [ ] Anuncios: No · Acceso a la app: PIN de demo declarado si se pide.
- [ ] Declaración UGC confirmada (evidencia: sección 5).

### Publicación
- [ ] AAB subido a Pruebas internas → verificado en dispositivo real (GPS, mapa, reseña PENDING, botón "Reportar", admin con PIN nuevo).
- [ ] Pruebas cerradas con ≥12 testers activos 14 días (solo cuentas personales nuevas). ⚠️
- [ ] Solicitud de acceso a producción aprobada (cuentas personales).
- [ ] AAB en Producción con notas de versión y lanzamiento iniciado.
- [ ] `versionCode` incrementado para el siguiente envío.

### Después del lanzamiento
- [ ] Monitorear Panel de Play Console (instalaciones, errores, reseñas de la tienda).
- [ ] Atender la cola de reseñas reportadas en el panel admin (Task 7-c).
- [ ] Moderar cola PENDING a diario al inicio (reseñas y sugerencias).
- [ ] Siguientes hitos del proyecto: fotos en la nube, expansión a los 10 municipios de Colima, iOS con la misma base Capacitor.

---

## Anexo · Referencia rápida de archivos del proyecto

| Archivo | Qué es |
|---|---|
| `.github/workflows/android-build.yml` | CI que genera el AAB/APK firmado (secrets de la sección 2.2). |
| `android/` · `android/app/build.gradle` | Proyecto Capacitor/Android y `versionCode`/`versionName`/`applicationId`. |
| `capacitor.config.ts` | Config de Capacitor (appId `com.rutaviva.colima`, appName `RutaViva`). |
| `src/components/rutaviva/` | Toda la UI: splash, mapa, lista, detalle con reseñas, admin (`admin/admin-panel.tsx`). |
| `src/app/api/` | APIs: `places`, `reviews`, `nearby`, `admin/*`. |
| `src/lib/server/moderation.ts` | Validadores de formatos (checklist de publicación). |
| `prisma/schema.prisma` · `prisma/seed.ts` | Modelos (SingularPlace/Review/Photo) y seed de 13 lugares de Manzanillo. |
| `public/icon-512.png` · `public/hero-manzanillo.png` | Ícono para la ficha y la imagen de portada (base del feature graphic). |
| `RUTAVIVA-ESTADO.md` · `worklog.md` | Documento maestro de continuidad y bitácora técnica. |

*Guía redactada como documentación (Task 7-b). No modifica código ni configuración. Requisitos de Google Play marcados con ⚠️ deben confirmarse en <https://play.google.com/console> al momento de publicar.*
