/**
 * Batería de pruebas del motor difuso contra el catálogo REAL de producción.
 * Uso: bun scripts/test-fuzzy.ts
 */
import { searchPlaces } from "../src/lib/fuzzy-search";

type P = { name: string; categoryLabel?: string; address?: string; distanceKm?: number };

const CATALOG: P[] = [
  "El Tortugario · Laguna de Cuyutlán",
  "Centro Histórico y Malecón",
  "Monumento al Pescador",
  "Playa Santiago",
  "Playa Miramar",
  "Playa La Audiencia",
  "Loncheria Beli",
  "Pollo Feliz",
  "Taqueria Don Pepe",
  "Loncheria El Polvorete",
  "Pollos asados Migue",
  "Rosty Pollo",
  "Tacolandia",
  "HOTDOGS de Santiago",
  "Pollos el Pechugon",
  "Tacos Erika",
  "Juzgado Penal Tercer Partido Judicial",
  "DIF Manzanillo",
  "Loncheria Star Coffe",
  "Unidad de Medicina Familiar",
  "Pollos El.Pechugon",
  "Pollos la Granja",
  "Tortas el polvorete",
  "Jardin Principal de Salagua",
  "Iguanario Archundia",
  "Tapode Ventanas",
  "Playa  De Campos",
  "Mirador Las Hadas",
  "Jardin el colomo",
  "Monumentonal Pez Vela",
  "Puestos de Tacos El Güero (Zona Salahua)",
  "Museo de la Sal de Cuyutlán",
  "Mercado Municipal",
  "Mirador de la Bahía de Santiago",
  "Playa Carrizales",
  "Playa Ventanas",
  "Playa La Boquita",
  "Playa Salahua",
].map((name) => ({ name, categoryLabel: "", address: "" }));

/** [consulta mal escrita, nombre esperado] */
const CASES: Array<[string, string]> = [
  ["mercdao", "Mercado Municipal"],
  ["marcaco municipal", "Mercado Municipal"],
  ["merka municipal", "Mercado Municipal"],
  ["marcaco", "Mercado Municipal"],
  ["campos", "Playa  De Campos"],
  ["playa de santiago", "Playa Santiago"],
  ["mercado manzanillo", "Mercado Municipal"],
  ["polo feliz", "Pollo Feliz"],
  ["polvorrete", "Loncheria El Polvorete"],
  ["tortas polvorete", "Tortas el polvorete"],
  ["pechugon", "Pollos el Pechugon"],
  ["pechugón", "Pollos el Pechugon"],
  ["taxolandia", "Tacolandia"],
  ["taqueria donpepe", "Taqueria Don Pepe"],
  ["salaha", "Playa Salahua"],
  ["salahua", "Playa Salahua"],
  ["boquita", "Playa La Boquita"],
  ["audiencia", "Playa La Audiencia"],
  ["iguanario", "Iguanario Archundia"],
  ["archundia", "Iguanario Archundia"],
  ["las hadas", "Mirador Las Hadas"],
  ["colomo", "Jardin el colomo"],
  ["pez vela", "Monumentonal Pez Vela"],
  ["monumento pez vela", "Monumentonal Pez Vela"],
  ["tortugario", "El Tortugario · Laguna de Cuyutlán"],
  ["cuyutlan", "Museo de la Sal de Cuyutlán"],
  ["ventanas", "Playa Ventanas"],
  ["decampos", "Playa  De Campos"],
  ["beli", "Loncheria Beli"],
  ["starcoffe", "Loncheria Star Coffe"],
  ["erika", "Tacos Erika"],
  ["juzgado", "Juzgado Penal Tercer Partido Judicial"],
  ["dif manzanillo", "DIF Manzanillo"],
  ["malecon", "Centro Histórico y Malecón"],
  ["pescador", "Monumento al Pescador"],
  ["miramar", "Playa Miramar"],
  ["carrizales", "Playa Carrizales"],
  ["güero", "Puestos de Tacos El Güero (Zona Salahua)"],
  ["guero", "Puestos de Tacos El Güero (Zona Salahua)"],
];

let pass = 0;
let fail = 0;
for (const [q, expected] of CASES) {
  const results = searchPlaces(CATALOG, q, 3);
  const ok = results.some((p) => p.name === expected);
  if (ok) {
    pass++;
    console.log(`OK    «${q}» → ${results[0]?.name ?? "—"}`);
  } else {
    fail++;
    console.log(`FAIL  «${q}» esperado=«${expected}» top3=[${results.map((r) => r.name).join(" | ") || "vacío"}]`);
  }
}

// Verificaciones de precisión: basura NO debe devolver nada.
const JUNK = ["pizza hut", "hola", "qwertyuiop", "xyzabc", "cafe del mar zzz"];
for (const q of JUNK) {
  const results = searchPlaces(CATALOG, q, 3);
  if (results.length === 0) {
    pass++;
    console.log(`OK    precisión: «${q}» → vacío`);
  } else {
    fail++;
    console.log(`FAIL  precisión: «${q}» devolvió [${results.map((r) => r.name).join(" | ")}]`);
  }
}

console.log(`\n${pass}/${CASES.length + JUNK.length} pasan`);
process.exit(fail > 0 ? 1 : 0);
