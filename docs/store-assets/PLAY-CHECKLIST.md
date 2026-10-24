# RutaViva · Checklist rápido de Google Play Console

> **App:** RutaViva — Guía turística de Manzanillo, Colima, México · `com.rutaviva.colima`
> **Guía completa:** `docs/PLAY-STORE.md` (textos de la ficha en §3, formularios en §4, AAB en §6)
> **Assets listos (Task 9-c):** `docs/store-assets/feature-graphic-1024x500.png` · `docs/store-assets/icon-512.png` · `public/privacidad.html`
> Marca cada casilla conforme la completes. Los puntos ⚠️ dependen de requisitos vigentes de la consola.

---

## A) Crear la app en Play Console

- [ ] Cuenta de Google Play Developer activa (tarifa única US$25) → <https://play.google.com/console>
- [ ] **Crear app** con estos datos exactos:
  - Nombre: `RutaViva: Guía de Manzanillo`
  - Idioma predeterminado: **Español (México)**
  - Tipo: **Aplicación**
  - Modelo: **Gratuita**
- [ ] Aceptar las declaraciones iniciales y crear la app.
- [ ] Decidir la vía de la cuenta (⚠️): **organizacional** (acceso a producción sin cuarentena) o **personal nueva** (exige pruebas cerradas: ver fase D).

## B) Ficha de la tienda (store listing)

Consola → **Crecimiento → Store presence → Ficha principal de Play Store**. Copiar/pegar los textos listos:

- [ ] Título (≤30 car.): `RutaViva: Guía de Manzanillo` — de `docs/PLAY-STORE.md` §3.1
- [ ] Descripción corta (≤80 car.): `Explora Manzanillo: playas, miradores, servicios y reseñas con mapa GPS.` — de §3.2
- [ ] Descripción completa (≤4000): copiar el bloque de §3.3 (ya incluye moderación UGC y "sin anuncios")
- [ ] **Ícono de la app 512×512 PNG** → subir `docs/store-assets/icon-512.png`
- [ ] **Gráfico de promoción 1024×500** → subir `docs/store-assets/feature-graphic-1024x500.png`
- [ ] **Capturas de teléfono** (mínimo 2, recomendado 1080×1920): pendiente de capturar — vistas y método en §3.5 (splash, mapa con franja, detalle con reseñas, panel Guía)
- [ ] Categoría: **Viajes y guías locales** · Etiquetas: Manzanillo, Colima, playas, guía turística, México
- [ ] Correo de contacto público visible en la ficha (`[correo@de-contacto]` — el mismo de la política de privacidad)

## C) Formularios obligatorios (Política → Contenido de la app)

- [ ] **Política de privacidad** → publicar `public/privacidad.html` en el dominio del backend y registrar la URL:
  `https://TU-DOMINIO/privacidad.html`
  (antes de registrar: sustituir en el HTML los placeholders `[TU NOMBRE o razón social]`, `[correo@de-contacto]` y `[sitio web o dominio]`)
- [ ] **Clasificación de contenido (IARC):** cuestionario honesto — guía turística sin violencia/sexo/apuestas; **contenido generado por usuarios: SÍ**, con moderación previa y botón de reporte (evidencia: `docs/PLAY-STORE.md` §5). Resultado esperado: **Todos / 3+** ⚠️
- [ ] **Seguridad de datos** — declarar según `public/privacidad.html` §2–3:
  - ¿Recopila datos? **Sí** · ¿Comparte con terceros? **No** · ¿Cifrada en tránsito? **Sí (HTTPS)**
  - Ubicación precisa (GPS): recopilada **solo en tiempo real para lugares cercanos**, opcional, no almacenada
  - Nombre (nombre mostrado opcional de reseñas): recopilado, fin de funcionalidad
  - Fotos: recopiladas, fin de funcionalidad
  - Otros contenidos generados por el usuario (texto de reseñas/sugerencias): recopilados, fin de funcionalidad
  - ¿Se usan para publicidad o marketing? **No** · ¿Ofreces borrado de datos? **Sí** (vía correo de contacto)
- [ ] **Público objetivo:** 13 años o más · **No** atrae deliberadamente a niños (evita el programa Familias) — coherente con la política (§7)
- [ ] **Anuncios:** **No, la app no contiene anuncios**
- [ ] **Acceso a la app:** si se pide, declarar panel administrativo con PIN y dar un **PIN de demostración** (nunca el de producción)
- [ ] Resto de declaraciones (noticias/COVID/gobierno/finanzas): **No** ⚠️

## D) Subir el AAB

- [ ] Secret `CAP_SERVER_URL` en GitHub = URL HTTPS del backend Railway (sin `https://` ni espacios mal puestos) → *Settings → Secrets and variables → Actions*
- [ ] Keystore de producción generado (keytool) y subido como secrets: `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (guía §2.4) — el keystore temporal del CI **no** sirve para producción
- [ ] Disparar el workflow (*Actions → Android Build → Run workflow*) y descargar el artefacto `rutaviva-android` (`app-release.aab`)
- [ ] **Pruebas internas:** subir el AAB + notas de versión + lista de testers → verificar en dispositivo real: GPS, mapa, reseña queda "en revisión", botón "Reportar", admin con PIN nuevo
- [ ] **Pruebas cerradas** (obligatorio si la cuenta es **personal nueva**): mismo AAB + **12 testers durante 14 días continuos** con actividad real ⚠️ → luego solicitar **acceso a producción**
- [ ] **Producción:** crear versión → subir AAB firmado con keystore real → notas ("Primera versión pública: guía de Manzanillo con mapa GPS, reseñas moderadas y reporte de contenido") → lanzar (o por fases 10% → 50% → 100%)
- [ ] Tras el primer envío, guardamos el keystore: Play App Signing lo inscribe como *upload key*

## E) Antes de publicar (¡no saltarse!)

- [ ] **Cambiar el PIN del admin por defecto** `rutaviva2025` → variable de entorno **`ADMIN_PIN`** en Railway (y `ADMIN_SECRET` = cadena aleatoria larga). Con el PIN por defecto cualquiera podría aprobar contenido
- [ ] **Verificar que el backend Railway esté vivo:** abrir la URL pública → la app carga, el mapa muestra lugares y `https://TU-DOMINIO/privacidad.html` responde 200
- [ ] **Confirmar el secret `CAP_SERVER_URL` en GitHub** apunta a esa URL y **re-generar el AAB** (nuevo run de Actions) para que la cáscara Android cargue el backend real
- [ ] Confirmar que la política de privacidad publicada **ya no tiene placeholders** visibles
- [ ] `versionCode` incrementado si ya se había subido una versión anterior (Play rechaza códigos repetidos)

---

*Basado en `docs/PLAY-STORE.md` (Task 7-b) y assets creados en Task 9-c. Puntos ⚠️: confirmar cifras/requisitos vigentes en la consola antes de responder.*
