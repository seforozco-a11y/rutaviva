/**
 * Búsqueda difusa «como suena» para el catálogo de RutaViva.
 *
 * Objetivo (petición de la dueña): encontrar un lugar sabiendo solo CÓMO
 * SUENA o una PARTE del nombre, sin saber escribirlo exacto. Ejemplos que
 * deben funcionar (batería en `scripts/test-fuzzy.ts`):
 *   «mercdao»           → Mercado Municipal          (letras intercambiadas)
 *   «marcaco municipal» → Mercado Municipal          (vocales trocadas)
 *   «decampos»          → Playa De Campos            (palabras pegadas)
 *   «playa de santiago» → Playa Santiago             (muletilla «de»)
 *   «mercado manzanillo»→ Mercado Municipal          (palabra de más)
 *   «polvorrete»        → Loncheria El Polvorete     (letra de más)
 *   «escolera»          → Escollera …                (letra faltante)
 *   «peñasco» / «penasco» → mismo resultado          (ñ sin tilde en el teclado)
 *
 * Todo corre en el CLIENTE sobre el catálogo ya cargado: sin llamadas al
 * servidor, instantáneo y sin costo. Cómo funciona:
 *
 * 1. normalizeText: minúsculas, sin acentos ni signos (NFD: ñ→n, ü→u).
 * 2. phoneticKey: colapsa las grafías que suenan igual en español latino:
 *    v→b, z→s, ce/ci→se/si, qu→k, c→k, ge/gi→je/ji, ll→y, h muda fuera,
 *    x→s, w→u y letras dobles colapsadas. La MISMA función se aplica al
 *    nombre y a la búsqueda: basta con que ambos «suenen igual».
 * 3. Puntaje: consulta completa como substring (con y SIN espacios) >
 *    palabra por palabra (igualdad exacta > prefijo > Damerau-Levenshtein
 *    con tolerancia según longitud > clave fonética igual > subsecuencia).
 *    Con Damerau, intercambiar letras vecinas («mercdao») cuesta 1, no 2.
 *    Las muletillas (de/del/la/el…) no rompen el emparejamiento y se
 *    tolera UNA palabra desconocida si otra coincide fuerte («mercado
 *    manzanillo»). Las palabras sueltas pueden apoyarse también en la
 *    categoría y la dirección (con peso menor).
 * 4. Corte por puntaje mínimo y orden final: puntaje desc, luego
 *    distancia asc, luego nombre (determinista para evitar saltos).
 */

/** Quita diacríticos con descomposición NFD (ñ→n, ü→u, á→a…). */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Minúsculas, sin acentos, solo letras/números y espacios simples. */
export function normalizeText(s: string): string {
  return stripDiacritics(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Clave fonética: colapsa a un mismo código las formas que suenan igual.
 * Se aplica POR IGUAL al nombre del lugar y a la consulta del usuario.
 */
export function phoneticKey(s: string): string {
  let t = normalizeText(s);
  if (!t) return "";
  t = t
    .replace(/ll/g, "y") // «gallina» ≈ «gayina»
    .replace(/h/g, "") // la h es muda: «pozahualca» ≈ «posaualca»
    .replace(/v/g, "b") // b/v suenan igual
    .replace(/z/g, "s") // z/s (español latino)
    .replace(/ce/g, "se")
    .replace(/ci/g, "si") // ce/ci suenan /s/
    .replace(/qu/g, "k") // «queso» ≈ «keso»
    .replace(/c/g, "k") // el resto de la c es /k/
    .replace(/ge/g, "je")
    .replace(/gi/g, "ji") // ge/gi suenan /x/
    .replace(/x/g, "s") // «xola» ≈ «sola»
    .replace(/w/g, "u")
    .replace(/(.)\1+/g, "$1"); // letras dobles colapsadas («carro»≈«caro»)
  return t;
}

/**
 * Distancia Damerau-Levenshtein (OSA) con poda: si supera `max`, devuelve
 * `max + 1` y corta temprano. A diferencia de Levenshtein simple, el
 * intercambio de dos letras VECINAS cuesta 1 («mercdao»→«mercado» = 1),
 * que es el error de tecleo más común.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const alen = a.length;
  const blen = b.length;
  if (Math.abs(alen - blen) > max) return max + 1;
  let prev2: number[] | null = null; // fila i-2 (para transposición)
  let prev = new Array<number>(blen + 1); // fila i-1
  let curr = new Array<number>(blen + 1); // fila i
  for (let j = 0; j <= blen; j++) prev[j] = j;
  for (let i = 1; i <= alen; i++) {
    curr[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    const caPrev = i > 1 ? a.charCodeAt(i - 2) : -1;
    for (let j = 1; j <= blen; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        prev2 &&
        ca === b.charCodeAt(j - 2) &&
        caPrev === b.charCodeAt(j - 1)
      ) {
        // Transposición de adyacentes: d[i-2][j-2] + 1.
        const t = prev2[j - 2] + 1;
        if (t < v) v = t;
      }
      if (v > max) v = max + 1;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const recycle = prev2;
    prev2 = prev;
    prev = curr;
    curr = recycle ?? new Array<number>(blen + 1);
  }
  return prev[blen] ?? max + 1;
}

/** ¿Las letras de `q` aparecen en orden dentro de `t`? (tolerancia amplia) */
function isSubsequence(q: string, t: string): boolean {
  let i = 0;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t.charCodeAt(j) === q.charCodeAt(i)) i++;
  }
  return i === q.length;
}

/** Errores de tecleo tolerados según el largo de la palabra buscada. */
function tolerance(len: number): number {
  if (len <= 2) return 0; // palabras de 1-2 letras: solo coincidencia exacta
  if (len <= 4) return 1;
  if (len <= 7) return 2;
  return 3;
}

/** Puntaje mínimo para considerar que un lugar «es el que el usuario oye». */
const MIN_SCORE = 20;

/**
 * Muletillas que la gente añade al hablar pero que no forman parte del
 * nombre («playa DE Santiago», «el mercado DE Manzanillo»). Si no
 * coinciden con nada, se ignoran en vez de romper la búsqueda.
 */
const FILLERS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "e", "o", "u",
  "en", "al", "a", "un", "una", "para", "con", "que", "es",
]);

/** Campos de un lugar que la búsqueda puede usar (suficiente con el DTO). */
export type SearchablePlace = {
  name: string;
  categoryLabel?: string | null;
  address?: string | null;
  description?: string | null;
  distanceKm?: number | null;
};

/**
 * Mejor puntaje de UNA palabra de la consulta contra las palabras del
 * nombre; si no coincide con ninguna, intenta con las palabras de apoyo
 * (categoría + dirección) a 0.75 de su valor. `null` = nada que ver.
 */
function bestTokenScore(
  qt: string,
  qpt: string,
  nameNormTokens: string[],
  namePhonTokens: string[],
  auxNormTokens: string[],
  auxPhonTokens: string[]
): number | null {
  const tol = tolerance(qt.length);
  let best: number | null = null;

  const tryTokens = (
    normTokens: string[],
    phonTokens: string[],
    factor: number
  ): void => {
    for (let i = 0; i < normTokens.length; i++) {
      const nt = normTokens[i];
      if (!nt) continue;
      const npt = phonTokens[i] ?? phoneticKey(nt);
      let s: number | null = null;
      if (nt === qt) {
        s = 60;
      } else if (qt.length >= 3 && nt.startsWith(qt)) {
        s = 45;
      } else if (nt.length >= 3 && qt.startsWith(nt)) {
        s = 40;
      } else if (qpt.length >= 2 && npt === qpt) {
        s = 36;
      } else if (tol > 0 && qt.length >= 3 && nt.length >= 3) {
        // La distancia solo aplica a palabras de 3+ letras: evita que
        // consultas cortas («hola») empaten con muletillas («la»).
        const dPhon = editDistance(qpt, npt, tol);
        if (dPhon <= tol) s = 36 - 8 * dPhon;
        const dNorm = editDistance(qt, nt, tol);
        if (dNorm <= tol) {
          const cand = 32 - 8 * dNorm;
          if (s == null || cand > s) s = cand;
        }
      }
      if (s == null && qt.length >= 3 && isSubsequence(qt, nt)) s = 12;
      if (s != null) {
        s = Math.round(s * factor);
        if (best == null || s > best) best = s;
      }
    }
  };

  tryTokens(nameNormTokens, namePhonTokens, 1);
  if (best == null || best < 45) {
    // La categoría/dirección solo rescatan palabras que el nombre no cubre.
    tryTokens(auxNormTokens, auxPhonTokens, 0.75);
  }
  return best;
}

function scorePlace(
  item: SearchablePlace,
  qNorm: string,
  qPhon: string,
  qNormTokens: string[],
  qPhonTokens: string[]
): number {
  const nameNorm = normalizeText(item.name);
  const namePhon = phoneticKey(item.name);
  let score = 0;

  // 1) La consulta completa dentro del nombre (normalizado, fonético y
  //    también SIN espacios: «decampos» ≈ «de campos»).
  if (qNorm.length >= 2 && nameNorm.includes(qNorm)) score = 100;
  if (score < 100 && qPhon.length >= 4 && namePhon.includes(qPhon)) {
    // 4+ letras: con 3, consultas cortas («hola»→«ola») caen dentro de
    // palabras largas sin relación («takolandia»).
    score = Math.max(score, 85);
  }
  const qCompact = qNorm.replace(/ /g, "");
  const nameCompact = nameNorm.replace(/ /g, "");
  if (score < 100 && qCompact.length >= 3 && nameCompact.includes(qCompact)) {
    score = Math.max(score, 82);
  }
  if (score < 82) {
    const qPhonCompact = qPhon.replace(/ /g, "");
    const namePhonCompact = namePhon.replace(/ /g, "");
    if (
      // 4+ letras: con 3, fragmentos que cruzan fronteras de palabras
      // («tortugariO LAguna» ⊃ «ola») causan falsos positivos.
      qPhonCompact.length >= 4 &&
      namePhonCompact.includes(qPhonCompact)
    ) {
      score = Math.max(score, 78);
    }
  }

  // 2) Palabra por palabra. Las muletillas (de/del/la…) que no coinciden
  //    con nada se ignoran; se tolera UNA palabra desconocida si otra
  //    coincide fuerte («mercado manzanillo» → Mercado Municipal).
  if (score < 78) {
    const nameNormTokens = nameNorm.split(" ").filter(Boolean);
    const namePhonTokens = namePhon.split(" ").filter(Boolean);
    const auxNorm = normalizeText(
      `${item.categoryLabel ?? ""} ${item.address ?? ""}`
    );
    const auxPhon = phoneticKey(`${item.categoryLabel ?? ""} ${item.address ?? ""}`);
    const auxNormTokens = auxNorm.split(" ").filter(Boolean);
    const auxPhonTokens = auxPhon.split(" ").filter(Boolean);

    const perToken: Array<number | null> = [];
    for (let i = 0; i < qNormTokens.length; i++) {
      const qt = qNormTokens[i];
      if (!qt) continue;
      const qpt = qPhonTokens[i] ?? phoneticKey(qt);
      const best = bestTokenScore(
        qt,
        qpt,
        nameNormTokens,
        namePhonTokens,
        auxNormTokens,
        auxPhonTokens
      );
      perToken.push(best);
    }

    let unknown = 0;
    let sum = 0;
    let count = 0;
    let strong = false;
    for (const s of perToken) {
      if (s == null) {
        unknown++;
        continue;
      }
      sum += s;
      count++;
      if (s >= 60) strong = true;
    }
    // Muletillas que no coincidieron: no cuentan como desconocidas.
    if (unknown > 0) {
      for (let i = 0; i < perToken.length; i++) {
        if (perToken[i] == null && FILLERS.has(qNormTokens[i] ?? "")) {
          unknown--;
        }
      }
    }
    if (count > 0 && unknown === 0) {
      const avg = sum / count;
      if (avg > score) score = avg;
    } else if (count > 0 && unknown === 1 && strong) {
      // Una palabra de más (p. ej. el nombre de la ciudad) no rompe la
      // búsqueda si el resto coincide con fuerza, pero penaliza: gana el
      // lugar que cubre MÁS palabras de la consulta (cov) y el que no
      // dejó desconocidas.
      const cov = count / (count + 1);
      const avg = (sum / count) * cov * 0.7;
      if (avg > score) score = avg;
    }
  }

  // 3) Sin nada por nombre: coincidencia en categoría/dirección/descripción
  //    (puntaje bajo pero suficiente para aparecer al final de la lista).
  if (score < MIN_SCORE) {
    const cat = item.categoryLabel ? normalizeText(item.categoryLabel) : "";
    const addr = item.address ? normalizeText(item.address) : "";
    const desc = item.description
      ? normalizeText(item.description).slice(0, 140)
      : "";
    if (
      cat.includes(qNorm) ||
      addr.includes(qNorm) ||
      (qNorm.length >= 4 && desc.includes(qNorm)) ||
      (qPhon.length >= 4 && cat && phoneticKey(item.categoryLabel ?? "").includes(qPhon))
    ) {
      score = MIN_SCORE;
    }
  }

  return score;
}

/**
 * Busca `rawQuery` entre `items` con tolerancia fonética/ortográfica.
 * Devuelve hasta `limit` resultados ordenados por relevancia (y distancia
 * como desempate). Si la consulta está vacía o es solo signos, devuelve los
 * items tal cual (sin filtrar) para que el llamador decida su orden.
 */
export function searchPlaces<T extends SearchablePlace>(
  items: readonly T[],
  rawQuery: string,
  limit = 8
): T[] {
  const q = rawQuery.trim();
  const qNorm = normalizeText(q);
  if (!qNorm) return [...items];

  const qPhon = phoneticKey(q);
  const qNormTokens = qNorm.split(" ").filter(Boolean);
  const qPhonTokens = qPhon.split(" ").filter(Boolean);

  const scored: Array<{ item: T; score: number; dist: number }> = [];
  for (const item of items) {
    const score = scorePlace(item, qNorm, qPhon, qNormTokens, qPhonTokens);
    if (score >= MIN_SCORE) {
      scored.push({ item, score, dist: item.distanceKm ?? 1e9 });
    }
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.dist - b.dist ||
      a.item.name.localeCompare(b.item.name)
  );
  return scored.slice(0, limit).map((r) => r.item);
}

/**
 * Depuración (scripts/test-fuzzy.ts): devuelve nombre + puntaje de todos
 * los lugares ordenados como lo haría searchPlaces, sin cortar.
 */
export function debugScores<T extends SearchablePlace>(
  items: readonly T[],
  rawQuery: string
): Array<{ name: string; score: number }> {
  const q = rawQuery.trim();
  const qNorm = normalizeText(q);
  if (!qNorm) return [];
  const qPhon = phoneticKey(q);
  const qNormTokens = qNorm.split(" ").filter(Boolean);
  const qPhonTokens = qPhon.split(" ").filter(Boolean);
  return items
    .map((item) => ({
      name: item.name,
      score: scorePlace(item, qNorm, qPhon, qNormTokens, qPhonTokens),
    }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
