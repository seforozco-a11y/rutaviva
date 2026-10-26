# RutaViva · imagen de producción para Railway (o cualquier Docker host)
# Build: Railway la detecta automáticamente (builder = DOCKERFILE en railway.toml)

# ---------- 1) Dependencias ----------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---------- 2) Build de Next.js ----------
FROM oven/bun:1 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL dummy para el build (PrismaClient se instancia al importar rutas)
ENV DATABASE_URL="file:/data/rutaviva.db"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ---------- 3) Runtime ----------
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# node_modules desde builder: incluye el cliente Prisma YA generado
COPY --from=builder /app/node_modules ./node_modules
# .next/standalone ya trae server.js + .next/static + public (lo copia `bun run build`)
COPY --from=builder /app/.next/standalone ./.next/standalone
# Prisma CLI + schema para `db push` en el arranque
COPY --from=builder /app/prisma ./prisma
# Scripts de arranque (migración + seed si la BD está vacía)
COPY --from=builder /app/scripts/start-railway.sh ./scripts/start-railway.sh
COPY --from=builder /app/scripts/seed-if-empty.ts ./scripts/seed-if-empty.ts

EXPOSE 3000
CMD ["bash", "scripts/start-railway.sh"]
