/**
 * Seed solo si la base de datos está vacía (primera vez en producción).
 * NO es destructivo: si ya existen lugares, no toca nada.
 * Ejecutar: bun scripts/seed-if-empty.ts
 */
import { db } from "../src/lib/db";

async function main() {
  const count = await db.singularPlace.count();
  if (count > 0) {
    console.log(`BD ya contiene ${count} lugares · seed omitido (no destructivo)`);
    return;
  }
  console.log("BD vacía · sembrando catálogo inicial de Manzanillo, Colima...");
  // prisma/seed.ts ejecuta su main() al importarse (limpia una BD vacía = sin efecto)
  await import("../prisma/seed");
  const after = await db.singularPlace.count();
  console.log(`Seed completado · ${after} lugares disponibles`);
}

main()
  .catch((e) => {
    console.error("seed-if-empty falló:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
