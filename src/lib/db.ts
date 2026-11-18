import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Tuning de conexión en runtime (enmienda de optimización ante conexión
 * masiva de usuarios). Cada instancia de función de Vercel abre su propio
 * pool contra Neon; sin límites explícitos, un pico de instancias multiplicaba
 * conexiones hasta saturar el pooler de la base de datos.
 *
 * - connection_limit=5 → tope de conexiones por instancia (recomendación de
 *   Neon para plataformas serverless en el plan gratis; el pooler multiplexa
 *   hacia la base con pocas conexiones reales).
 * - pool_timeout=15 → bajo pico, una petición ESPERA en cola hasta 15 s por
 *   una conexión libre en vez de fallar al instante (error P2024).
 * - connect_timeout=15 → tolera el "despertar" de Neon tras la autosuspensión
 *   del plan gratis (~5 min sin tráfico) sin cortar la primera petición.
 * - pgbouncer=true cuando la URL apunta al pooler de Neon (host *-pooler*):
 *   desactiva prepared statements, requisito del modo transacción de
 *   PgBouncer — evita el clásico "prepared statement … already exists" bajo
 *   carga concurrente.
 *
 * Reglas de seguridad del cambio:
 * - Solo aplica a postgres:// y postgresql:// — con SQLite local (file:) es
 *   un no-op y el desarrollo sigue exactamente igual.
 * - Nunca MODIFICA un parámetro ya presente en la URL; solo añade los que
 *   falten (si Vercel/Neon inyectan valores propios, se respetan).
 */
function tunePostgresUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl || !/^postgres(ql)?:\/\//i.test(rawUrl)) return rawUrl
  const extras: string[] = []
  if (!/connection_limit=/.test(rawUrl)) extras.push('connection_limit=5')
  if (!/pool_timeout=/.test(rawUrl)) extras.push('pool_timeout=15')
  if (!/connect_timeout=/.test(rawUrl)) extras.push('connect_timeout=15')
  // Host = lo que está entre el último @ (fin de credenciales) y el primer / o ?
  const host = /@([^/?]+)/.exec(rawUrl)?.[1] ?? ''
  if (host.includes('pooler') && !/pgbouncer=/.test(rawUrl)) {
    extras.push('pgbouncer=true')
  }
  if (extras.length === 0) return rawUrl
  return rawUrl + (rawUrl.includes('?') ? '&' : '?') + extras.join('&')
}

const tunedUrl = tunePostgresUrl(process.env.DATABASE_URL)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // En desarrollo registramos cada query (visibilidad en dev.log); en
    // producción solo errores: loguear cada query multiplicaría I/O de stdout
    // justo cuando más importa el rendimiento (picos de usuarios).
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query'],
    datasources: tunedUrl ? { db: { url: tunedUrl } } : undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
