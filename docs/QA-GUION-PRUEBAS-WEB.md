# 🧪 Guion de pruebas web — RutaViva

> **Para compartir con quien quiera ayudar probando.**
> Probar en la web es probar la app de verdad: el teléfono carga esta misma página
> dentro de la aplicación. Todo lo que se suba pasa por el panel del equipo antes
> de publicarse — **nada se hace público sin revisión**.

---

## 📲 Datos de acceso

| Dato | Valor |
|---|---|
| **URL** | https://rutaviva-seven.vercel.app |
| **URL directa: lista de lugares** | https://rutaviva-seven.vercel.app/?view=list |
| **URL directa: sugerir un lugar** | https://rutaviva-seven.vercel.app/?view=add |
| **Duración total** | ~15 minutos |
| **Qué necesitas** | Celular o computadora con internet (ideal: celular, para probar GPS) |
| **Cuenta** | No se necesita registro ni contraseña |

> 💡 **Enlaces directos:** las URLs con `?view=…` abren esa pantalla después de
> la portada (el primer acceso muestra la bienvenida; los siguientes van
> directo). Funcionan una vez por visita — si recargas, vuelves al mapa normal.
> 💡 Consejo: haz las pruebas desde el celular si puedes — así validamos GPS,
> cámara/galería y los botones en pantalla chica, que es como la usará la gente.

---

## 🧭 P1 · Entrar a la app

1. Abre la URL y espera la pantalla de bienvenida.
2. Acepta la **ubicación** cuando el navegador la pida (botón "Explorar cerca de mí").
   - Si no quieres dar tu ubicación: usa **"Explorar la ciudad (ubicación demo)"**.

✅ **Esperado:** el mapa se abre centrado en Manzanillo (o en tu zona si diste
ubicación) y se ven pines de colores.

---

## 🗺️ P2 · Explorar el mapa

1. Mueve el mapa, haz zoom con los dedos y toca un **pin**.
2. Toca los botones de categorías (Playa, Mirador, Gastronomía… según aparezcan).

✅ **Esperado:** al tocar un pin se abre su ficha; el mapa se mueve con fluidez
sin pantallas en blanco.

---

## 📋 P3 · Ficha de un lugar

1. Toca un pin (por ejemplo **Escollera de San Pedrito** o **Playa San Pedrito**).
2. Revisa: fotos (desliza), nombre, categoría, descripción, **tip local**, dirección.
3. Toca una foto para verla a pantalla completa y ciérrala.

✅ **Esperado:** la ficha abre con su galería navegable; el visor de fotos abre
y cierra bien.

---

## 🧭 P4 · Botón "Cómo llegar" (¡importante, lo acabamos de arreglar!)

1. En la ficha de un lugar junto al mar (prueba **Escollera de San Pedrito**),
   toca **"Cómo llegar"**.
2. Debe abrirse **Google Maps** con la ruta hacia el lugar.

✅ **Esperado:** Google Maps abre **sin ningún mensaje de error** y traza la
ruta hasta el punto (3–4 km aprox. desde el centro). Si te sale un error o un
pin en el mar, captura pantalla — es justo lo que buscamos confirmar.

---

## 📚 P5 · Lista de lugares y servicios

> 🔗 Enlace directo: https://rutaviva-seven.vercel.app/?view=list

1. En la barra inferior toca **"Lugares"**.
2. Cambia entre las pestañas: **Singulares, Farmacias, Gasolineras, Conveniencia,
   Súper, Cajeros**.
3. Toca cualquier resultado para abrir su ficha.

✅ **Esperado:** cada pestaña carga sus resultados; los más cercanos aparecen
con su distancia.

---

## 📍 P6 · Sugerir un lugar nuevo (flujo estrella ⭐)

> 🔗 Enlace directo: https://rutaviva-seven.vercel.app/?view=add

1. Toca el botón naranja **"Sugiere un lugar singular"**.
2. Llena: nombre, descripción (mínimo 30 caracteres), categoría, coordenadas
   (o botón **"Usar mi ubicación"**), dirección opcional.
3. Sube **1 o más fotos** desde tu galería (máximo 5).
4. Agrega un tip si quieres y **tu nombre** en "Sugerido por".
5. Envía.

✅ **Esperado:** mensaje de agradecimiento tipo *"¡Gracias por tu aporte! El
lugar entró a revisión…"*. **No** aparece publicado de inmediato (el equipo lo
valida en el panel) — eso es correcto.

> 🙏 Pon "(PRUEBA)" al inicio del nombre para que el equipo la identifique y la
> descarte después de revisarla.

---

## ⭐ P7 · Dejar una reseña con foto

1. Abre la ficha de cualquier lugar y baja a la sección de reseñas.
2. Escribe tu nombre, pon **estrellas (1–5)** y un comentario
   (mínimo 5, máximo 800 caracteres).
3. Sube hasta **3 fotos** y envía.

✅ **Esperado:** confirmación de que la reseña entró a revisión. No se publica
al instante — así se evita el spam.

---

## 🚩 P8 · Reportar una reseña

1. En la ficha de un lugar, busca una reseña ya publicada.
2. Toca el botón de **reportar** (banderita) y escribe un motivo breve,
   por ejemplo: "prueba de reporte".
3. Envía el reporte.

✅ **Esperado:** confirmación de reporte enviado. La reseña reportada se oculta
al público hasta que el equipo la revise — eso es lo correcto (avísale al equipo
para descartar el reporte y devolverla).

---

## 🔎 P9 · Detalles finales

1. En el mapa, prueba el botón de **centrar en mi ubicación** (si diste permiso).
2. Abre el **aviso de privacidad** (enlace al pie del formulario de sugerencias).
3. Gira el celular (horizontal) y vuelve: nada debe romperse.

✅ **Esperado:** todo responde sin errores ni textos en inglés sueltos.

---

## 🧭 P10 · Canales de comentarios (¡nuevo!)

**A) Reportar un lugar con datos erróneos:**
1. Abre la ficha de cualquier lugar (o servicio de farmacia/gasolinera).
2. Al final toca **"¿Información incorrecta o desactualizada? Repórtalo"**.
3. Elige un motivo (ubicación, cerrado, info que no corresponde, duplicado…),
   agrega detalles si quieres y envía.

✅ **Esperado:** confirmación "nuestro equipo lo revisará pronto". El reporte
llega clasificado al panel del equipo (no oculta el lugar: el equipo corrige).

**B) Ayuda y comentarios sobre la app:**
1. En el mapa, toca el chip **"Ayuda y comentarios"** (junto al estado del GPS).
2. Elige: "Algo no funciona", "Una idea o mejora", "Contenido inapropiado" u
   "Otro", escribe detalles y envía.

✅ **Esperado:** confirmación de envío. La app adjunta sola el tipo de
dispositivo para ayudarnos a reproducir el problema.

**C) Reseñas con motivo más preciso:**
1. Reporta una reseña: ahora aparecen **motivos frecuentes con un toque**
   (spam, ofensivo, información falsa, fuera de tema) que precargan el texto.

✅ **Esperado:** el motivo se llena al tocar el chip y puedes editarlo.

**D) Guía de la app (pestaña nueva):**
1. En la barra de abajo toca la pestaña **"Guía"** (junto a Admin). También
   puedes abrir directamente: **`?view=about`** →
   `https://rutaviva-seven.vercel.app/?view=about`
2. Revisa que se vea: estadísticas, cómo funciona la publicación
   (sugieres → validamos → se publica), la tarjeta "¿Algo falla?", el
   Aviso de privacidad y las tarjetas informativas.
3. Al final, toca **"Ver la portada otra vez"** y regresa con "Explorar".

✅ **Esperado:** la guía abre y se lee completa sin errores; la portada
vuelve a mostrarse y al explorar regresas al mapa.

---

## 🐞 Cómo reportar un problema

Copia este formato y mándalo por WhatsApp a quien te invitó:

```
🐞 BUG RutaViva
Prueba: (P1 a P10)
¿Qué hiciste?: (pasos exactos)
¿Qué esperaba?: 
¿Qué pasó?: 
Celular/navegador: (ej. Samsung A54 / Chrome)
Captura de pantalla: (adjunta si puedes)
```

**Los bugs más valiosos de encontrar:**
- Algo que no responde o se queda cargando
- Textos cortados o botones imposibles de tocar
- Fotos que no suben o se ven giradas
- "Cómo llegar" con error
- Errores con letras raras en inglés (mándalos tal cual)

---

## 🙌 ¿Y esto para qué sirve?

- Nos ayuda a **cazar errores antes de que la gente real llegue** a la app.
- Todo lo que se prueba en la web usa el mismo sistema que la app de Android.
- ¡Cuando la app salga a producción, quien ayudó a probar ya la conocerá de memoria!
