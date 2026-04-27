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
  // eslint-disable-next-line no-var
  var __triketrackColumnExistsCache: Map<string, Promise<boolean>> | undefined
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
  "public.qr_codes",
  "public.report_types",
  "public.routes",
  "public.driver_locations",
  "public.trips",
  "public.trip_route_points",
  "public.trip_routes",
  "public.passenger_scans",
  "public.reports",
  "public.trip_points",
  "public.violations",
  "public.violation_types",
  "public.mobile_violations",
  "public.violation_appeals",
  "public.violation_proofs"
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

const ensureSchemaCompatibility = async () => {
  await query(`
    ALTER TABLE IF EXISTS public.routes
    ADD COLUMN IF NOT EXISTS default_fare_amount numeric(10,2)
  `)

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'route_default_fare_check'
          AND conrelid = 'public.routes'::regclass
      ) THEN
        ALTER TABLE public.routes
        ADD CONSTRAINT route_default_fare_check
        CHECK (default_fare_amount IS NULL OR default_fare_amount >= 0);
      END IF;
    END $$;
  `)
}

export const ensureDatabaseReady = () => {
  if (!globalThis.__triketrackDatabaseReady) {
    globalThis.__triketrackDatabaseReady = (async () => {
      await verifySchema()
      await ensureSchemaCompatibility()
    })()
  }

  return globalThis.__triketrackDatabaseReady
}

export const hasColumn = (
  schemaName: string,
  tableName: string,
  columnName: string
) => {
  if (!globalThis.__triketrackColumnExistsCache) {
    globalThis.__triketrackColumnExistsCache = new Map()
  }

  const cacheKey = `${schemaName}.${tableName}.${columnName}`
  const cachedResult = globalThis.__triketrackColumnExistsCache.get(cacheKey)
  if (cachedResult) return cachedResult

  const pendingResult = query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
      ) AS exists
    `,
    [schemaName, tableName, columnName]
  )
    .then((result) => result.rows[0]?.exists === true)
    .catch((error) => {
      globalThis.__triketrackColumnExistsCache?.delete(cacheKey)
      throw error
    })

  globalThis.__triketrackColumnExistsCache.set(cacheKey, pendingResult)
  return pendingResult
}

export const hasTable = async (schemaName: string, tableName: string) => {
  const result = await query<{ regclass: string | null }>(
    "SELECT to_regclass($1) AS regclass",
    [`${schemaName}.${tableName}`]
  )

  return result.rows[0]?.regclass !== null
}

export const checkDatabaseHealth = async () => {
  await ensureDatabaseReady()
  const result = await query<{ ok: number }>("SELECT 1 AS ok")
  return result.rows[0]?.ok === 1
}
