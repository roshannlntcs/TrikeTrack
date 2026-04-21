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

export type GeofenceDeviationInput = {
  dedupeKey: string
  driverId: number
  tripId?: number | null
  routeId?: number | null
  tricycleId?: number | null
  ts: number
  lng: number
  lat: number
  routeLabel?: string
}

const GEOFENCE_DEVIATION_CODE = "geofence_deviation"

declare global {
  // eslint-disable-next-line no-var
  var __triketrackViolationsReady: Promise<void> | undefined
}

const ensureViolationSchemaReady = async () => {
  await ensureDatabaseReady()

  await query(`
    ALTER TABLE public.violations
    ADD COLUMN IF NOT EXISTS latitude double precision
  `)
  await query(`
    ALTER TABLE public.violations
    ADD COLUMN IF NOT EXISTS longitude double precision
  `)
  await query(`
    ALTER TABLE public.violations
    ADD COLUMN IF NOT EXISTS location_label text
  `)
  await query(`
    ALTER TABLE public.violations
    ADD COLUMN IF NOT EXISTS dedupe_key text
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_violations_dedupe_key
    ON public.violations(dedupe_key)
    WHERE dedupe_key IS NOT NULL
  `)
}

export const ensureViolationStorageReady = () => {
  if (!globalThis.__triketrackViolationsReady) {
    globalThis.__triketrackViolationsReady = ensureViolationSchemaReady().catch((error) => {
      globalThis.__triketrackViolationsReady = undefined
      throw error
    })
  }

  return globalThis.__triketrackViolationsReady
}

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
  detectedAtIso: string,
  dedupeKey?: string
) => {
  if (dedupeKey) {
    const byKeyResult = await client.query<{ violation_id: number }>(
      `
        SELECT violation_id
        FROM public.violations
        WHERE dedupe_key = $1
        LIMIT 1
      `,
      [dedupeKey]
    )

    if (byKeyResult.rows[0]?.violation_id) {
      return byKeyResult.rows[0].violation_id
    }
  }

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
  await ensureViolationStorageReady()

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
      const dedupeKey = `client:${violation.id}`
      const duplicateId = await findRecentDuplicate(
        client,
        violationTypeId,
        driverId,
        detectedAtIso,
        dedupeKey
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
            latitude,
            longitude,
            location_label,
            dedupe_key,
            detected_at,
            source,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, 'system', 'open')
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        `,
        [
          violationTypeId,
          driverId,
          description,
          violation.lat,
          violation.lng,
          `${violation.lat.toFixed(5)}, ${violation.lng.toFixed(5)}`,
          dedupeKey,
          detectedAtIso
        ]
      )

      results.push({
        id: violation.id,
        status: "stored"
      })
    }

    return results
  })
}

export const storeGeofenceDeviationViolation = async (
  violation: GeofenceDeviationInput
): Promise<ViolationBatchResult> => {
  await ensureViolationStorageReady()

  const violationTypeId = await getViolationTypeId()
  if (!violationTypeId) {
    return {
      id: violation.dedupeKey,
      status: "rejected",
      reason: "MISSING_VIOLATION_TYPE_GEOFENCE_DEVIATION"
    }
  }

  return withTransaction(async (client) => {
    const detectedAtIso = new Date(violation.ts).toISOString()
    const duplicateId = await findRecentDuplicate(
      client,
      violationTypeId,
      violation.driverId,
      detectedAtIso,
      violation.dedupeKey
    )

    if (duplicateId) {
      return {
        id: violation.dedupeKey,
        status: "duplicate"
      }
    }

    const locationLabel = `${violation.lat.toFixed(5)}, ${violation.lng.toFixed(5)}`
    const description = [
      "Automatic geofence deviation detected from trip telemetry.",
      `Coordinates: ${locationLabel}.`,
      violation.routeLabel ? `Route: ${violation.routeLabel}.` : undefined
    ]
      .filter(Boolean)
      .join(" ")

    const result = await client.query<{ violation_id: number }>(
      `
        INSERT INTO public.violations (
          violation_type_id,
          trip_id,
          driver_id,
          tricycle_id,
          description,
          latitude,
          longitude,
          location_label,
          dedupe_key,
          detected_at,
          source,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, 'system', 'open')
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
        RETURNING violation_id
      `,
      [
        violationTypeId,
        violation.tripId ?? null,
        violation.driverId,
        violation.tricycleId ?? null,
        description,
        violation.lat,
        violation.lng,
        locationLabel,
        violation.dedupeKey,
        detectedAtIso
      ]
    )

    return {
      id: violation.dedupeKey,
      status: result.rowCount === 0 ? "duplicate" : "stored"
    }
  })
}
