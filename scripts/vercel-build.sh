#!/bin/bash
# Build de producción para Vercel: cambia Prisma a PostgreSQL, sincroniza
# la base, siembra si está vacía y compila Next.js.
# El desarrollo local sigue usando SQLite (este script SOLO corre en Vercel).
set -e
cd "$(dirname "$0")/.."

echo "── RutaViva · build Vercel (PostgreSQL) ──"

# 1) Resolver conexión Postgres (Vercel + Neon inyecta POSTGRES_URL / DATABASE_URL)
PG_URL="${DATABASE_URL:-${POSTGRES_URL:-}}"
if [ -z "$PG_URL" ]; then
  echo "ERROR: falta DATABASE_URL/POSTGRES_URL (conecta Neon Postgres al proyecto)" >&2
  exit 1
fi
case "$PG_URL" in
  postgresql://*|postgres://*) : ;;
  *) echo "ERROR: la conexión no es PostgreSQL" >&2; exit 1 ;;
esac
export DATABASE_URL="$PG_URL"
# Conexión directa para db push (Neon: POSTGRES_URL_NON_POOLING; si no hay, usa la misma)
DIRECT_URL="${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-$PG_URL}}"
export DIRECT_URL

# 2) Reescribir el datasource a PostgreSQL en el contenedor de build (no toca el repo)
node - <<'EOF'
const fs = require("fs");
let s = fs.readFileSync("prisma/schema.prisma", "utf8");
s = s.replace(
  /datasource db \{[^}]*\}/,
  `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
);
fs.writeFileSync("prisma/schema.prisma", s);
console.log("schema.prisma → provider postgresql ✓");
EOF

# 3) Generar cliente Prisma PostgreSQL
echo "prisma generate..."
npx prisma generate

# 4) Sincronizar schema (no destructivo: falla a propósito si un cambio perdería datos)
echo "prisma db push..."
npx prisma db push --skip-generate

# 4b) Auto-reparación de banderas de imágenes incrustadas (idempotente, corre
# en cada build): coverInline/inline deben reflejar SIEMPRE el contenido real
# de la fila — si una fila tiene base64 sin bandera, el JSON público lo
# expondría (defecto visto en producción el 18 nov 2026). Una sentencia por
# llamada: db execute no garantiza lotes multi-statement. IMPORTANTE: usar
# --schema (el datasource ya reescrito a PostgreSQL); con --url aislada el
# comando puede ejecutarse contra el datasource del schema y no contra Neon.
echo "reparando banderas de imágenes inline..."
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
UPDATE "SingularPlace" SET "coverInline" = ("imageUrl" LIKE 'data:%') WHERE "coverInline" <> ("imageUrl" LIKE 'data:%');
SQL
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
UPDATE "Photo" SET "inline" = ("url" LIKE 'data:%') WHERE "inline" <> ("url" LIKE 'data:%');
SQL

# 4c) Dedupe de la galería (idempotente, corre en cada build): filas Photo de
# galería (sin reviewId) con el MISMO lugar y la MISMA url quedaron duplicadas
# por el defecto del 19 nov 2026 (el diálogo de edición antepone la portada
# aunque la galería ya la contiene; recortar una copia dejaba original + recorte
# publicados). Se conserva UNA fila por (placeId, url): preferimos la visible
# (archived=false), luego la de menor orden, luego la más antigua. Las fotos de
# reseñas (reviewId) y las sugerencias sin lugar (placeId null) NO se tocan.
echo "deduplicando galería..."
npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DELETE FROM "Photo"
WHERE "reviewId" IS NULL AND "placeId" IS NOT NULL AND "id" NOT IN (
  SELECT DISTINCT ON ("placeId", "url") "id" FROM "Photo"
  WHERE "reviewId" IS NULL AND "placeId" IS NOT NULL
  ORDER BY "placeId" ASC, "url" ASC, "archived" ASC, "order" ASC, "createdAt" ASC, "id" ASC
);
SQL

# 5) Sembrar catálogo solo si la BD está vacía
echo "seed si está vacía..."
if command -v bun >/dev/null 2>&1; then
  bun scripts/seed-if-empty.ts
else
  npx tsx scripts/seed-if-empty.ts
fi

# 6) Build de Next.js (el script "build" también copia static+public a standalone)
echo "next build..."
if command -v bun >/dev/null 2>&1; then
  bun run build
else
  npm run build
fi
