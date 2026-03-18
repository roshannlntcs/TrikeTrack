import { Pool, type PoolClient } from "pg"

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/triketrack"

const shouldUseSsl = () => {
  const raw = (process.env.DATABASE_SSL ?? "").trim().toLowerCase()
  return raw === "1" || raw === "true" || raw === "require"
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackPgPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __triketrackDatabaseReady: Promise<void> | undefined
}

const createPool = () =>
  new Pool({
    connectionString: DATABASE_URL,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : undefined
  })

export const getPool = () => {
  if (!globalThis.__triketrackPgPool) {
    globalThis.__triketrackPgPool = createPool()
  }
  return globalThis.__triketrackPgPool
}

export const query = <TRow extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) => getPool().query<TRow>(text, params)

export const withTransaction = async <T>(
  work: (client: PoolClient) => Promise<T>
) => {
  const client = await getPool().connect()

  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

const REQUIRED_TABLES = [
  "public.barangays",
  "public.todas",
  "public.admin_accounts",
  "public.drivers",
  "public.tricycles",
  "public.routes",
  "public.trips",
  "public.trip_points",
  "public.violations",
  "public.violation_types"
] as const

const verifySchema = async () => {
  for (const tableName of REQUIRED_TABLES) {
    const result = await query<{ regclass: string | null }>(
      "SELECT to_regclass($1) AS regclass",
      [tableName]
    )
    if (!result.rows[0]?.regclass) {
      throw new Error(`Required table is missing: ${tableName}`)
    }
  }
}

export const ensureDatabaseReady = () => {
  if (!globalThis.__triketrackDatabaseReady) {
    globalThis.__triketrackDatabaseReady = verifySchema()
  }

  return globalThis.__triketrackDatabaseReady
}

export const checkDatabaseHealth = async () => {
  await ensureDatabaseReady()
  const result = await query<{ ok: number }>("SELECT 1 AS ok")
  return result.rows[0]?.ok === 1
}
