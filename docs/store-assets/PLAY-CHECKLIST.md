# RutaViva · Checklist rápido de Google Play Console

> **App:** RutaViva — Guía turística de Manzanillo, Colima, México · `com.rutaviva.colima`
> **Guía completa:** `docs/PLAY-STORE.md` (textos de la ficha en §3, formularios en §4, AAB en §6)
> **Assets listos:** `docs/store-assets/feature-graphic-1024x500.png` (1024×500 ✓) · `docs/store-assets/icon-512.png` (512×512 ✓) · 4 capturas 1080×2340 en `docs/store-assets/screenshots/` ✓ · `public/privacidad.html` ya PUBLICADA sin placeholders ✓
> **✅ ACTUALIZADO 28/oct — ya hecho (no repetir):** backend en producción Vercel+Neon (https://rutaviva-seven.vercel.app, Railway era plan B) · `ADMIN_PIN` real en envs de Vercel (ya NO es el default) · `ADMIN_SECRET` configurado · `CAP_SERVER_URL` en GitHub apunta a producción · keystore real en secrets de CI (válido a 2056) · AAB firmado verificado (run 40160381094) · aviso de privacidad in-app (Task 27) · login admin tolerante (Task 28) · BD limpia sin registros demo (Task 28).
> Marca cada casilla conforme la completes. Los puntos ⚠️ dependen de requisitos vigentes de la consola.

---

## A) Crear la app en Play Console

- [x] **Cuenta de Google Play Developer ACTIVA (30/oct)** — cuenta **personal** de seforozco · ID de cuenta: `7732893812949273279` · tarifa US$25 pagada · identidad verificada → <https://play.google.com/console>
- [ ] **⏭️ SIGUIENTE PASO — Crear app** con estos datos exactos:
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
- [x] **Ícono de la app 512×512 PNG** → subir `docs/store-assets/icon-512.png`
- [x] **Gráfico de promoción 1024×500** → subir `docs/store-assets/feature-graphic-1024x500.png`
- [x] **Capturas de teléfono** (mínimo 2): LISTAS — `docs/store-assets/screenshots/01-portada.png` a `04-guia.png` (1080×2340, 4 imágenes)
- [x] Correo de contacto público visible en la ficha: **`viverutaviva@gmail.com`** — DECISIÓN 31/oct (Opción B del dueño): buzón oficial de RutaViva; privacidad.html actualizada a este correo (4 menciones) + deploy requerido para que producción coincida. Teléfono `+52 314 125 7661` público; sitio web opcional.

- [x] Categoría: **"Viajes y lugares"** (nombre actual en la consola; antes "Viajes y guías locales") · Etiquetas sugeridas: "Viajes y lugares" (+ opcionales: Guías de viaje, Mapas y navegación GPS)

## C) Formularios obligatorios (Política → Contenido de la app)

- [x] **Política de privacidad** → registrada en la consola (31/oct):
  `https://rutaviva-seven.vercel.app/privacidad.html`
- [x] **Clasificación de contenido (IARC):** COMPLETADA (31/oct) — UGC respondido Sí con moderación previa + botón de reporte; todo lo demás No. Resultado esperado: Todos/3+.
- [ ] **Seguridad de datos** — instrucciones entregadas al dueño 31/oct; declarar según `public/privacidad.html` §2–3:
  - ¿Recopila datos? **Sí** · ¿Comparte con terceros? **No** · ¿Cifrada en tránsito? **Sí (HTTPS)**
  - Ubicación precisa (GPS): recopilada **solo en tiempo real para lugares cercanos**, opcional, no almacenada
  - Nombre (nombre mostrado opcional de reseñas): recopilado, fin de funcionalidad
  - Fotos: recopiladas, fin de funcionalidad
  - Otros contenidos generados por el usuario (texto de reseñas/sugerencias): recopilados, fin de funcionalidad
  - ¿Se usan para publicidad o marketing? **No** · ¿Ofreces borrado de datos? **Sí** (vía correo de contacto)
- [x] **Público objetivo:** 13+ · no atrae a niños (31/oct) · **Anuncios:** No · **Gobierno/finanzas/salud:** No
- [x] **Acceso a la app:** código soporta `ADMIN_DEMO_PIN` (env en Vercel, tipo encrypted, 3 targets) + deploy verificado en prod (login demo → 200, falso → 401). Respuesta al formulario: **Sí, hay funcionalidad restringida** → panel de moderación en `/admin` con PIN de demostración (valor guardado SOLO en `.tmp-auth/demo-pin` local y en el chat — este repo es público, no subirlo aquí). Tras la aprobación de la app: revocar borrando el env + redesplegar.
- [x] Resto de declaraciones (noticias/COVID/gobierno/finanzas): **No**

## D) Subir el AAB

- [x] Secret `CAP_SERVER_URL` en GitHub = `https://rutaviva-seven.vercel.app` ✓ ya configurado
- [x] Keystore de producción en secrets ✓ ya configurado (el CI firma con él automáticamente en cada push)
- [ ] Descargar el AAB: *GitHub → Actions → run más reciente en verde → artefacto `rutaviva-android` → `bundle/release/app-release.aab`* (cada push a main genera uno nuevo; el verificado original es el run 40160381094, descargable hasta 2027)
- [ ] **Pruebas internas:** subir el AAB + notas de versión + tu correo como tester → instalar en tu celular desde el enlace de pruebas y verificar: GPS, mapa, reseña queda "en revisión", botón "Reportar", admin con PIN nuevo
- [ ] **Pruebas cerradas** (obligatorio si la cuenta es **personal nueva**): mismo AAB + **12 testers durante 14 días continuos** con actividad real ⚠️ → luego solicitar **acceso a producción**
- [ ] **Producción:** crear versión → subir AAB firmado con keystore real → notas ("Primera versión pública: guía de Manzanillo con mapa GPS, reseñas moderadas y reporte de contenido") → lanzar (o por fases 10% → 50% → 100%)
- [ ] Tras el primer envío, guardamos el keystore: Play App Signing lo inscribe como *upload key*

## E) Antes de publicar (¡no saltarse!)

- [x] **Cambiar el PIN del admin por defecto** → hecho: `ADMIN_PIN` real en envs de Vercel (Task 28 verificó login tolerante)
- [x] **Verificar que el backend esté vivo:** https://rutaviva-seven.vercel.app carga, 18 lugares, `privacidad.html` responde 200 ✓ (verificado 28/oct)
- [x] Confirmar que la política de privacidad publicada **ya no tiene placeholders** ✓
- [ ] `versionCode` incrementado si ya se había subido una versión anterior (Play rechaza códigos repetidos)

---

*Basado en `docs/PLAY-STORE.md` (Task 7-b) y assets creados en Task 9-c. Puntos ⚠️: confirmar cifras/requisitos vigentes en la consola antes de responder.*
