import { ensureDatabaseReady, hasTable, query } from "./database"

declare global {
  // eslint-disable-next-line no-var
  var __triketrackOperationalAnomalyLastRun: number | undefined
}

const MIN_SCAN_INTERVAL_MS = 30_000

export const runOperationalAnomalyDetection = async () => {
  await ensureDatabaseReady()

  const hasTrips = await hasTable("public", "trips")
  const hasTripPoints = await hasTable("public", "trip_points")
  const hasViolations = await hasTable("public", "mobile_violations")
  if (!hasTrips || !hasTripPoints || !hasViolations) {
    return 0
  }

  const functionResult = await query<{ regprocedure: string | null }>(
    "SELECT to_regprocedure('public.detect_trip_operational_anomalies()')::text AS regprocedure"
  )
  if (!functionResult.rows[0]?.regprocedure) {
    return 0
  }

  const now = Date.now()
  const lastRun = globalThis.__triketrackOperationalAnomalyLastRun ?? 0
  if (now - lastRun < MIN_SCAN_INTERVAL_MS) {
    return 0
  }

  globalThis.__triketrackOperationalAnomalyLastRun = now

  const result = await query<{ inserted_count: number }>(
    "SELECT public.detect_trip_operational_anomalies() AS inserted_count"
  )

  return Number(result.rows[0]?.inserted_count ?? 0)
}
