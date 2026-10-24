#!/bin/bash
# Arranque de RutaViva en producción (Railway).
# 1. asegura el directorio de la BD (volumen), 2. aplica el schema,
# 3. siembra el catálogo solo si la BD está vacía, 4. arranca Next standalone.
set -e

echo "── RutaViva · arranque producción ──"

# 1) Asegurar que el directorio de la BD exista (volumen montado en /data)
DB_PATH="${DATABASE_URL:-file:/data/rutaviva.db}"
DB_PATH="${DB_PATH#file:}"
DB_DIR="$(dirname "$DB_PATH")"
if [ ! -d "$DB_DIR" ]; then
  echo "Creando directorio de base de datos: $DB_DIR"
  mkdir -p "$DB_DIR" 2>/dev/null || {
    echo "AVISO: no se pudo crear $DB_DIR (¿falta el volumen?). Monta un volumen en /data y define DATABASE_URL=file:/data/rutaviva.db" >&2
  }
fi

# 2) Aplicar el schema de Prisma (idempotente; falla si un cambio sería destructivo — intencional)
echo "Aplicando schema de Prisma..."
bunx prisma db push --skip-generate

# 3) Seed solo si la base está vacía (primera vez con volumen nuevo)
bun scripts/seed-if-empty.ts

# 4) Servidor Next.js standalone (respeta PORT de Railway, default 3000)
echo "Iniciando servidor en el puerto ${PORT:-3000}..."
exec bun ./.next/standalone/server.js
