import type { PoolClient } from "pg"
import { ensureDatabaseReady, query, withTransaction } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"

export type ViolationBatchItem = {
  id: string
  type: "violation"
  driverId: string
  ts: number
  lng: number
  lat: number
  reason: "OUTSIDE_ROUTE_CORRIDOR"
  routeId: string
  speed?: number
  heading?: number
  accuracy?: number
}

export type ViolationBatchResult = {
  id: string
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}

const GEOFENCE_DEVIATION_CODE = "geofence_deviation"

const getViolationTypeId = async () => {
  const result = await query<{ violation_type_id: number }>(
    `
      SELECT violation_type_id
      FROM public.violation_types
      WHERE code = $1
      LIMIT 1
    `,
    [GEOFENCE_DEVIATION_CODE]
  )

  return result.rows[0]?.violation_type_id ?? null
}

const findRecentDuplicate = async (
  client: PoolClient,
  violationTypeId: number,
  driverId: number,
  detectedAtIso: string
) => {
  const result = await client.query<{ violation_id: number }>(
    `
      SELECT violation_id
      FROM public.violations
      WHERE violation_type_id = $1
        AND driver_id = $2
        AND source = 'system'
        AND detected_at BETWEEN ($3::timestamptz - INTERVAL '60 seconds')
                            AND ($3::timestamptz + INTERVAL '60 seconds')
      ORDER BY detected_at DESC
      LIMIT 1
    `,
    [violationTypeId, driverId, detectedAtIso]
  )

  return result.rows[0]?.violation_id ?? null
}

export const storeViolationBatch = async (violations: ViolationBatchItem[]) => {
  await ensureDatabaseReady()

  const violationTypeId = await getViolationTypeId()
  if (!violationTypeId) {
    return violations.map<ViolationBatchResult>((violation) => ({
      id: violation.id,
      status: "rejected",
      reason: "MISSING_VIOLATION_TYPE_GEOFENCE_DEVIATION"
    }))
  }

  return withTransaction(async (client) => {
    const results: ViolationBatchResult[] = []

    for (const violation of violations) {
      const driverId = await resolveDriverIdFromIdentifier(violation.driverId)
      if (!driverId) {
        results.push({
          id: violation.id,
          status: "rejected",
          reason: "DRIVER_NOT_FOUND"
        })
        continue
      }

      const detectedAtIso = new Date(violation.ts).toISOString()
      const duplicateId = await findRecentDuplicate(
        client,
        violationTypeId,
        driverId,
        detectedAtIso
      )

      if (duplicateId) {
        results.push({
          id: violation.id,
          status: "duplicate"
        })
        continue
      }

      const description = [
        "Automatic geofence deviation detected.",
        `Coordinates: ${violation.lat.toFixed(5)}, ${violation.lng.toFixed(5)}.`,
        `Route ref: ${violation.routeId}.`
      ].join(" ")

      await client.query(
        `
          INSERT INTO public.violations (
            violation_type_id,
            driver_id,
            description,
            detected_at,
            source,
            status
          )
          VALUES ($1, $2, $3, $4::timestamptz, 'system', 'open')
        `,
        [violationTypeId, driverId, description, detectedAtIso]
      )

      results.push({
        id: violation.id,
        status: "stored"
      })
    }

    return results
  })
}
