import type { PoolClient } from "pg"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query, withTransaction } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"
import { reverseGeocodeLocationName } from "./reverse-geocode"

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

export type AdminViolationStatusUpdate = "open" | "under_review" | "resolved"
export type AdminViolationAlertSource = "system_violation" | "driver_violation"

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
    ALTER TABLE public.mobile_violations
    ADD COLUMN IF NOT EXISTS dedupe_key text
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_violations_dedupe_key
    ON public.violations(dedupe_key)
    WHERE dedupe_key IS NOT NULL
  `)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_violations_dedupe_key
    ON public.mobile_violations(dedupe_key)
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

      const locationLabel = await reverseGeocodeLocationName({
        latitude: violation.lat,
        longitude: violation.lng,
        fallbackLabel: "Location name unavailable"
      })
      const description = [
        "Automatic geofence deviation detected.",
        locationLabel ? `Location: ${locationLabel}.` : undefined,
        `Route ref: ${violation.routeId}.`
      ]
        .filter(Boolean)
        .join(" ")

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
          locationLabel,
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

    const locationLabel = await reverseGeocodeLocationName({
      latitude: violation.lat,
      longitude: violation.lng,
      fallbackLabel: "Location name unavailable"
    })
    const description = [
      "Automatic geofence deviation detected from trip telemetry.",
      locationLabel ? `Location: ${locationLabel}.` : undefined,
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

const assertViolationInAdminScope = async (
  profile: AdminProfile,
  source: AdminViolationAlertSource,
  violationId: string
) => {
  if (profile.role === "superadmin") return

  const numericTodaId = profile.todaId ?? null
  const numericBarangayId = profile.barangayId ?? null
  const toNullableNumber = (value: number | string | null | undefined) => {
    if (value === null || typeof value === "undefined") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (source === "system_violation") {
    const result = await query<{
      toda_id: number | string | null
      barangay_id: number | string | null
    }>(
      `
        SELECT
          COALESCE(d.toda_id, r.toda_id) AS toda_id,
          b.barangay_id
        FROM public.violations v
        LEFT JOIN public.drivers d
          ON d.driver_id = v.driver_id
        LEFT JOIN public.trips tp
          ON tp.trip_id = v.trip_id
        LEFT JOIN public.routes r
          ON r.route_id = tp.route_id
        LEFT JOIN public.todas td
          ON td.toda_id = COALESCE(d.toda_id, r.toda_id)
        LEFT JOIN public.barangays b
          ON b.barangay_id = td.barangay_id
        WHERE v.violation_id = $1
        LIMIT 1
      `,
      [Number(violationId)]
    )
    const row = result.rows[0]
    const rowTodaId = toNullableNumber(row?.toda_id)
    const rowBarangayId = toNullableNumber(row?.barangay_id)
    if (
      !row ||
      (profile.role === "toda_admin" && rowTodaId !== numericTodaId) ||
      (profile.role === "barangay_admin" && rowBarangayId !== numericBarangayId)
    ) {
      throw new Error("Violation alert not found in your admin scope.")
    }
    return
  }

  const result = await query<{ toda_id: number | string; barangay_id: number | string }>(
    `
      SELECT d.toda_id, b.barangay_id
      FROM public.mobile_violations mv
      JOIN public.drivers d
        ON d.driver_id = mv.driver_id
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      WHERE mv.id = $1::uuid
      LIMIT 1
    `,
    [violationId]
  )
  const row = result.rows[0]
  const rowTodaId = toNullableNumber(row?.toda_id)
  const rowBarangayId = toNullableNumber(row?.barangay_id)
  if (
    !row ||
    (profile.role === "toda_admin" && rowTodaId !== numericTodaId) ||
    (profile.role === "barangay_admin" && rowBarangayId !== numericBarangayId)
  ) {
    throw new Error("Violation alert not found in your admin scope.")
  }
}

export const updateViolationStatusForAdmin = async (
  profile: AdminProfile,
  source: AdminViolationAlertSource,
  violationId: string,
  status: AdminViolationStatusUpdate
) => {
  await ensureViolationStorageReady()
  await assertViolationInAdminScope(profile, source, violationId)

  const mobileStatus =
    status === "open"
      ? "OPEN"
      : status === "under_review"
        ? "UNDER_REVIEW"
        : "RESOLVED"

  if (source === "system_violation") {
    const result = await query<{
      violation_id: number
      driver_id: number | null
      trip_id: number | null
      detected_at: string
      description: string | null
      latitude: number | null
      longitude: number | null
      location_label: string | null
      violation_type_code: string | null
      violation_type_label: string | null
    }>(
      `
        UPDATE public.violations v
        SET status = $2::public.violation_status
        FROM public.violation_types vt
        WHERE v.violation_id = $1
          AND vt.violation_type_id = v.violation_type_id
        RETURNING
          v.violation_id,
          v.driver_id,
          v.trip_id,
          v.detected_at,
          v.description,
          v.latitude,
          v.longitude,
          v.location_label,
          vt.code AS violation_type_code,
          vt.label AS violation_type_label
      `,
      [Number(violationId), status]
    )
    const updated = result.rows[0]
    if (!updated) throw new Error("Unable to update violation alert.")

    const isGeofenceViolation =
      `${updated.violation_type_code ?? ""} ${updated.violation_type_label ?? ""} ${updated.description ?? ""}`
        .toLowerCase()
        .includes("geofence") ||
      `${updated.violation_type_code ?? ""} ${updated.violation_type_label ?? ""} ${updated.description ?? ""}`
        .toLowerCase()
        .includes("boundary")

    if (updated.driver_id && isGeofenceViolation) {
      await query(
        `
          INSERT INTO public.mobile_violations (
            driver_id,
            trip_id,
            type,
            status,
            priority,
            occurred_at,
            title,
            latitude,
            longitude,
            location_label,
            details,
            dedupe_key
          )
          VALUES (
            $1,
            $2,
            'GEOFENCE_BOUNDARY'::public.mobile_violation_type,
            $3::public.mobile_violation_status,
            'HIGH'::public.mobile_violation_priority,
            $4,
            COALESCE($5, 'Geofence Boundary Violation'),
            $6,
            $7,
            $8,
            $9,
            $10
          )
          ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE
          SET
            status = EXCLUDED.status,
            trip_id = COALESCE(EXCLUDED.trip_id, public.mobile_violations.trip_id),
            title = COALESCE(EXCLUDED.title, public.mobile_violations.title),
            latitude = COALESCE(EXCLUDED.latitude, public.mobile_violations.latitude),
            longitude = COALESCE(EXCLUDED.longitude, public.mobile_violations.longitude),
            location_label = COALESCE(EXCLUDED.location_label, public.mobile_violations.location_label),
            details = COALESCE(EXCLUDED.details, public.mobile_violations.details)
        `,
        [
          updated.driver_id,
          updated.trip_id,
          mobileStatus,
          updated.detected_at,
          updated.violation_type_label,
          updated.latitude,
          updated.longitude,
          updated.location_label,
          updated.description,
          `system-violation:${updated.violation_id}`
        ]
      )
    }
    return
  }

  const result = await query<{ id: string }>(
    `
      UPDATE public.mobile_violations
      SET status = $2::public.mobile_violation_status
      WHERE id = $1::uuid
      RETURNING id
    `,
    [violationId, mobileStatus]
  )
  if (!result.rows[0]) throw new Error("Unable to update violation alert.")
}
