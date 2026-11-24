/**
 * Búsqueda difusa «como suena» para el catálogo de RutaViva.
 *
 * Objetivo (petición de la dueña, 24-nov-2026): encontrar un lugar sabiendo
 * solo CÓMO SUENA o una PARTE del nombre, sin saber escribirlo exacto.
 * Ejemplos que deben funcionar:
 *   «sin pedrito»       → Escollera de San Pedrito   (n/m trocadas por sonido)
 *   «marcaco municipal» → Mercado Municipal          (e/a trocadas)
 *   «la posaulca»       → … La Pozahualca            (h muda, z/s)
 *   «escolera»          → Escollera …                (letra faltante)
 *   «peñasco» / «penasco» → mismo resultado           (ñ sin tilde en el teclado)
 *
 * Todo corre en el CLIENTE sobre el catálogo ya cargado: sin llamadas al
 * servidor, instantáneo y sin costo. Cómo funciona:
 *
 * 1. normalizeText: minúsculas, sin acentos ni signos (NFD: ñ→n, ü→u).
 * 2. phoneticKey: colapsa las grafías que suenan igual en español latino:
 *    v→b, z→s, ce/ci→se/si, qu→k, c→k, ge/gi→je/ji, ll→y, h muda fuera,
 *    x→s, w→u y letras dobles colapsadas. La MISMA función se aplica al
 *    nombre y a la búsqueda: basta con que ambos «suenen igual».
 * 3. Puntaje: consulta completa como substring > palabra por palabra
 *    (igualdad exacta > prefijo > Levenshtein con tolerancia según
 *    longitud > clave fonética igual > subsecuencia de letras).
 *    Las palabras sueltas pueden apoyarse también en la categoría y la
 *    dirección (con peso menor): «playa san pedrito» funciona.
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
 * Distancia de edición (Levenshtein) con poda: si supera `max`, devuelve
 * `max + 1` y corta temprano (no importa el valor exacto, solo el corte).
 */
function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  const alen = a.length;
  const blen = b.length;
  if (Math.abs(alen - blen) > max) return max + 1;
  let prev = new Array<number>(blen + 1);
  let curr = new Array<number>(blen + 1);
  for (let j = 0; j <= blen; j++) prev[j] = j;
  for (let i = 1; i <= alen; i++) {
    curr[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= blen; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (v > max) v = max + 1;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  const result = prev[blen];
  return result ?? max + 1;
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
const MIN_SCORE = 24;

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
      } else if (tol > 0 && qt.length >= 3) {
        const dPhon = levenshtein(qpt, npt, tol);
        if (dPhon <= tol) s = 36 - 8 * dPhon;
        const dNorm = levenshtein(qt, nt, tol);
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

  // 1) La consulta completa dentro del nombre (normalizado y fonético).
  if (qNorm.length >= 2 && nameNorm.includes(qNorm)) score = 100;
  if (score < 100 && qPhon.length >= 3 && namePhon.includes(qPhon)) score = 85;

  // 2) Palabra por palabra: TODAS deben coincidir con algo.
  if (score < 85) {
    const nameNormTokens = nameNorm.split(" ").filter(Boolean);
    const namePhonTokens = namePhon.split(" ").filter(Boolean);
    const auxNorm = normalizeText(
      `${item.categoryLabel ?? ""} ${item.address ?? ""}`
    );
    const auxPhon = phoneticKey(`${item.categoryLabel ?? ""} ${item.address ?? ""}`);
    const auxNormTokens = auxNorm.split(" ").filter(Boolean);
    const auxPhonTokens = auxPhon.split(" ").filter(Boolean);
    let sum = 0;
    let all = true;
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
      if (best == null) {
        all = false;
        break;
      }
      sum += best;
    }
    if (all) {
      const avg = sum / qNormTokens.length;
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
