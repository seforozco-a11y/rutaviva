/**
 * Deploy a producción de Vercel por API (el token es de equipo y el CLI
 * falla con "User not found" al pedir /v2/user; la API acepta teamId).
 *
 * Uso: bun scripts/deploy-vercel.ts [--dry]
 * Requiere /home/z/.vercel-token (chmod 600).
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const TOKEN = readFileSync("/home/z/.vercel-token", "utf8").trim();
const TEAM_ID = "team_kHOKJaxDF4lHveDDN7pZvho6";
const PROJECT = "rutaviva";

// Carpetas que NO aporta nada al build de Next.js en Vercel (docs, app
// Android Capacitor, assets nativos y la BD local de desarrollo).
const EXCLUDE_DIRS = new Set(["docs", "android", "assets", "db", ".github"]);

const dry = process.argv.includes("--dry");

function listFiles(): string[] {
  const out = Bun.spawnSync(["git", "ls-files"], { cwd: ROOT });
  return out.stdout.toString().trim().split("\n").filter(Boolean);
}

function isTextual(buf: Uint8Array): boolean {
  // Heurística: bytes 0 en los primeros 8KB => binario.
  const probe = buf.subarray(0, 8192);
  return !probe.includes(0);
}

const all = listFiles();
const files = all.filter((f) => {
  const top = f.split("/")[0];
  if (EXCLUDE_DIRS.has(top)) return false;
  try {
    return statSync(join(ROOT, f)).isFile();
  } catch {
    return false;
  }
});

const excludedMB =
  (all.length - files.length) + " archivos excluidos de " + all.length;

const payloadFiles = files.map((f) => {
  const buf = readFileSync(join(ROOT, f));
  if (isTextual(buf)) {
    return { file: f, data: buf.toString("utf8"), encoding: "utf-8" as const };
  }
  return { file: f, data: buf.toString("base64"), encoding: "base64" as const };
});

const totalMB =
  payloadFiles.reduce((s, f) => s + (f.data?.length ?? 0), 0) / 1024 / 1024;
console.log(`${excludedMB}; subiendo ${payloadFiles.length} archivos (~${totalMB.toFixed(1)} MB)`);
if (dry) {
  console.log(files.slice(0, 40).join("\n"));
  process.exit(0);
}

const sha = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: ROOT })
  .stdout.toString().trim();
const msg = Bun.spawnSync(["git", "log", "-1", "--pretty=%s"], { cwd: ROOT })
  .stdout.toString().trim();

const res = await fetch(
  `https://api.vercel.com/v13/deployments?skipAutoDetectionChanged=1&teamId=${TEAM_ID}`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: PROJECT,
      target: "production",
      meta: { githubCommitSha: sha, githubCommitMessage: msg.slice(0, 200) },
      projectSettings: {
        framework: "nextjs",
        buildCommand: null,
        installCommand: null,
        devCommand: null,
        outputDirectory: null,
      },
      files: payloadFiles,
    }),
  }
);

const created = await res.json();
if (!res.ok) {
  console.error("ERROR creando deployment:", res.status, JSON.stringify(created).slice(0, 600));
  process.exit(1);
}
const depId: string = created.id;
console.log("Deployment creado:", depId, created.url ?? "");

// Poll hasta READY/ERROR (máx ~6 min).
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 6000));
  const r2 = await fetch(
    `https://api.vercel.com/v13/deployments/${depId}?teamId=${TEAM_ID}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  const d = await r2.json();
  const state = d.readyState ?? d.status;
  if (state === "READY" || state === "ERROR" || state === "CANCELED") {
    console.log("Estado final:", state);
    if (d.buildingAt) console.log("build ok en", d.readyAt ? Math.round((d.readyAt - d.buildingAt) / 1000) + "s" : "-");
    if (state !== "READY") {
      if (d.errorMessage) console.error("errorMessage:", d.errorMessage);
      const logs = await fetch(
        `https://api.vercel.com/v2/deployments/${depId}/events?limit=100&teamId=${TEAM_ID}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      ).then((r) => r.json());
      for (const ev of logs ?? []) {
        const t = ev.payload?.text ?? ev.text ?? "";
        if (t) console.log("·", String(t).slice(0, 220));
      }
      process.exit(1);
    }
    console.log("URL:", d.url);
    console.log("Alias producción asignado:", d.alias?.join(", "));
    process.exit(0);
  }
  if (i % 5 === 0) console.log(`… ${state} (${i * 6}s)`);
}
console.error("Timeout esperando el deployment");
process.exit(1);
