/**
 * Seed solo si la base de datos está vacía (primera vez en producción).
 * NO es destructivo: si ya existen lugares, no toca nada.
 * Ejecutar: bun scripts/seed-if-empty.ts
 *
 * NOTA (bug corregido 2026-10-25): antes se hacía `await import("../prisma/seed")`,
 * pero seed.ts lanza main() como promesa flotante y su import NO espera las
 * inserciones; el process.exit(0) posterior mataba el seed a medias ("0 lugares").
 * Ahora se ejecuta prisma/seed.ts como SUBPROCESO y se espera su salida real.
 */
import { spawnSync } from "child_process";
import { db } from "../src/lib/db";

async function main() {
  const count = await db.singularPlace.count();
  if (count > 0) {
    console.log(`BD ya contiene ${count} lugares · seed omitido (no destructivo)`);
    return;
  }
  console.log("BD vacía · sembrando catálogo inicial de Manzanillo, Colima...");

  // Ejecuta prisma/seed.ts como subproceso: su main() corre al evaluarse el
  // módulo y su exit code refleja el resultado real del seed.
  const hasBun = spawnSync("bun", ["--version"], { stdio: "ignore" }).status === 0;
  const cmd = hasBun ? "bun" : "npx";
  const args = hasBun ? ["prisma/seed.ts"] : ["tsx", "prisma/seed.ts"];
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env, // hereda DATABASE_URL / DIRECT_URL del build de Vercel
  });
  if (res.status !== 0) {
    throw new Error(`prisma/seed.ts terminó con código ${res.status}`);
  }

  const after = await db.singularPlace.count();
  console.log(`Seed completado · ${after} lugares disponibles`);
  if (after === 0) {
    throw new Error("el seed no insertó lugares");
  }
}

main()
  .catch((e) => {
    console.error("seed-if-empty falló:", e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
