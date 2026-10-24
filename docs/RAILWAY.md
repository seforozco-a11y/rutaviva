# RutaViva · Despliegue en Railway + Push a GitHub

> Guía paso a paso para dejar el backend corriendo en Railway y disparar el primer build del AAB.
> Al final tendrás: **URL https pública** (para la app web y el APK) + **AAB firmado** listo para Play Console.

---

## Fase 0 · Subir el repo a GitHub (10 min)

El proyecto ya está commiteado localmente (rama `main`). Solo falta conectarlo a GitHub.

### Opción A — con GitHub CLI (recomendada)
```bash
# 1. Instala gh (una vez): https://cli.github.com/
gh auth login
# 2. Crea el repo y sube todo en un solo paso (desde la carpeta del proyecto):
gh repo create rutaviva --public --source . --push
```

### Opción B — manual (web)
1. Entra a **https://github.com/new** y crea el repo (nombre sugerido: `rutaviva`), **sin** README ni .gitignore iniciales.
2. Desde la carpeta del proyecto:
```bash
./scripts/gh-push.sh TU-USUARIO rutaviva public
```
   (o `git remote add origin https://github.com/TU-USUARIO/rutaviva.git && git push -u origin main`)

> 🔒 El `.env` local NO se sube (está en `.gitignore` y des-trackeado). Los secretos de firma van como *secrets* de GitHub, nunca en el código.

---

## Fase 1 · Desplegar en Railway (15–20 min)

### 1.1 Crear el proyecto
```bash
# Instala la CLI (una vez): npm i -g @railwaycli  (o brew install railway)
railway login            # abre el navegador para autorizar
railway init             # nombre sugerido: rutaviva  ·  type: Empty project
```

### 1.2 Agregar el volumen persistente (para la base SQLite)
```bash
railway volume add --mount-path /data
```
> La base de datos (SQLite) vive en ese volumen: sobrevive a cada deploy. Cuando la app crezca, la migración a PostgreSQL está documentada al final.

### 1.3 Configurar variables de entorno
```bash
railway variables --set "DATABASE_URL=file:/data/rutaviva.db"
railway variables --set "NODE_ENV=production"
railway variables --set "NEXT_TELEMETRY_DISABLED=1"
railway variables --set "ADMIN_PIN=TU-PIN-SEGURO"        # ⚠️ NUNCA el de demo (rutaviva2025)
railway variables --set "ADMIN_SECRET=genera-una-cadena-larga-y-aleatoria"
```
> Genera el `ADMIN_SECRET` con: `openssl rand -hex 32`

### 1.4 Desplegar
```bash
railway up
```
- Railway detecta el `Dockerfile` + `railway.toml` y construye (primera vez ~5–10 min).
- Al arrancar, `scripts/start-railway.sh` aplica el schema de Prisma y **siembra el catálogo de Manzanillo solo si la BD está vacía** (no destructivo).
- Verifica los logs: `railway logs`

### 1.5 Obtener tu URL pública
```bash
railway domain
```
Genera algo como `https://rutaviva-production-XXXX.up.railway.app`. Ábrela: verás la portada de RutaViva con el catálogo real. ✅

**Comprobaciones rápidas:**
- [ ] La portada carga y el mapa muestra los 13 lugares
- [ ] `https://TU-URL/privacidad.html` muestra la política de privacidad (edítala antes: tiene los placeholders `[TU NOMBRE]` y `[correo@de-contacto]` — cámbialos en `public/privacidad.html` y vuelve a hacer push)
- [ ] Panel admin (escudo) entra con tu `ADMIN_PIN`

---

## Fase 2 · Conectar todo: CI del AAB con tu URL (5 min)

1. En tu repo de GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - `CAP_SERVER_URL` = `https://TU-URL.up.railway.app`
2. (Opcional, para el AAB firmado de producción — ver `docs/PLAY-STORE.md` §3)
   - `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
3. Pestaña **Actions** → workflow **"Android AAB (RutaViva)"** → *Run workflow* → descarga el artefacto `rutaviva-android` (contiene `app-release.aab` + `app-release.apk`).
4. El APK ya apunta a tu backend de Railway: instálalo (el `.apk`) en tu teléfono para probarlo en la calle. 🎉

> Cada `git push` a `main` que toque `src/`, `android/` o el config regenera el AAB automáticamente.

---

## Fase 3 · Actualizaciones en el futuro

| Qué cambió | Qué hacer |
|---|---|
| Contenido (lugares, reseñas) | Nada: se hace desde el panel admin de la app |
| Código de la app | `git push` → Railway redespliega + CI regenera AAB |
| Schema de Prisma | `git push` → el arranque ejecuta `prisma db push` (los cambios destructivos fallarán a propósito: revísalos antes) |
| Versión para Play | Sube `versionCode` en `android/app/build.gradle` antes del push |

---

## Notas y escalado

- **Costos Railway:** plan Hobby incluye crédito mensual; el volumen y las horas de servicio consumen según uso — revisa precios vigentes en railway.com/pricing.
- **SQLite → PostgreSQL (cuando escales):** cambia el provider en `prisma/schema.prisma`, agrega el plugin de Postgres en Railway, crea la variable `DATABASE_URL` del plugin y ejecuta `prisma migrate` — hay detalle en `docs/PLAY-STORE.md` §3.
- **Dominio propio (opcional):** `railway domain` → opción *custom domain* → apunta tu CNAME. Si lo cambias, actualiza `CAP_SERVER_URL` y regenera AAB.
- **Salud:** Railway hace healthcheck en `/` (configurado en `railway.toml`, reinicia con reintentos ante fallos).

---

*Guía de Play Console y textos de la ficha: `docs/PLAY-STORE.md` · Assets listos: `docs/store-assets/` · Checklist rápido: `docs/store-assets/PLAY-CHECKLIST.md`*
