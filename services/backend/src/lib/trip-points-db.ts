import type { TripPointEvent } from "./operational-types"
import { ensureDatabaseReady, query } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"
import { upsertDriverLocation } from "./driver-locations-db"
import { rebuildTripPathForTrip } from "./trip-paths-db"

export type TripPointBatchResult = {
  dedupKey: string
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}

type TripPointRow = {
  dedup_key: string
  driver_id: number
  trip_id: number | null
  recorded_at: Date
  lng: number
  lat: number
  speed: number | null
  heading: number | null
  accuracy: number | null
  created_at: Date
}

export type StoredTripPoint = {
  dedupKey: string
  driverId: string
  tripId?: string
  ts: number
  lng: number
  lat: number
  speed?: number
  heading?: number
  accuracy?: number
  storedAt: string
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackTripPointsReady: Promise<void> | undefined
}

const mapTripPoint = (row: TripPointRow): StoredTripPoint => ({
  dedupKey: row.dedup_key,
  driverId: String(row.driver_id),
  tripId: row.trip_id === null ? undefined : String(row.trip_id),
  ts: row.recorded_at.getTime(),
  lng: row.lng,
  lat: row.lat,
  speed: row.speed ?? undefined,
  heading: row.heading ?? undefined,
  accuracy: row.accuracy ?? undefined,
  storedAt: row.created_at.toISOString()
})

const parsePositiveInteger = (value: string) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

export const createTripPointDedupKey = (point: TripPointEvent) => {
  const lngBucket = Math.round(point.lng * 100000)
  const latBucket = Math.round(point.lat * 100000)
  return [
    point.driverId.trim(),
    point.tripId?.trim() || "no-trip",
    point.ts,
    `${lngBucket}:${latBucket}`
  ].join("|")
}

const ensureTripPointSchemaReady = async () => {
  await ensureDatabaseReady()

  const result = await query<{ regclass: string | null }>(
    "SELECT to_regclass($1) AS regclass",
    ["public.trip_points"]
  )

  if (!result.rows[0]?.regclass) {
    throw new Error("Required table is missing: public.trip_points")
  }
}

export const ensureTripPointStorageReady = () => {
  if (!globalThis.__triketrackTripPointsReady) {
    globalThis.__triketrackTripPointsReady = ensureTripPointSchemaReady()
  }

  return globalThis.__triketrackTripPointsReady
}

const insertTripPoint = async (
  point: TripPointEvent
): Promise<TripPointBatchResult> => {
  const dedupKey = createTripPointDedupKey(point)
  const driverId = await resolveDriverIdFromIdentifier(point.driverId)
  if (!driverId) {
    return {
      dedupKey,
      status: "rejected",
      reason: "DRIVER_NOT_FOUND"
    }
  }

  let tripId: number | null = null
  if (point.tripId !== undefined) {
    tripId = parsePositiveInteger(point.tripId)
    if (!tripId) {
      return {
        dedupKey,
        status: "rejected",
        reason: "TRIP_ID_MUST_BE_NUMERIC"
      }
    }

    const tripResult = await query<{ trip_id: number }>(
      `
        SELECT trip_id
        FROM public.trips
        WHERE trip_id = $1
          AND driver_id = $2
        LIMIT 1
      `,
      [tripId, driverId]
    )

    if (!tripResult.rows[0]?.trip_id) {
      return {
        dedupKey,
        status: "rejected",
        reason: "TRIP_NOT_FOUND_FOR_DRIVER"
      }
    }
  }

  try {
    const result = await query<{ point_id: number }>(
      `
        INSERT INTO public.trip_points (
          trip_id,
          driver_id,
          recorded_at,
          lng,
          lat,
          speed,
          heading,
          accuracy,
          dedup_key
        )
        VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (dedup_key) DO NOTHING
        RETURNING point_id
      `,
      [
        tripId,
        driverId,
        new Date(point.ts).toISOString(),
        point.lng,
        point.lat,
        point.speed ?? null,
        point.heading ?? null,
        point.accuracy ?? null,
        dedupKey
      ]
    )

    return {
      dedupKey,
      status: result.rowCount === 0 ? "duplicate" : "stored"
    }
  } catch (error) {
    const pgError = error as { code?: string; constraint?: string } | undefined
    if (pgError?.code === "23503") {
      if (pgError.constraint === "trip_points_driver_id_fkey") {
        return {
          dedupKey,
          status: "rejected",
          reason: "DRIVER_NOT_FOUND"
        }
      }

      if (pgError.constraint === "trip_points_trip_id_fkey") {
        return {
          dedupKey,
          status: "rejected",
          reason: "TRIP_NOT_FOUND"
        }
      }
    }

    throw error
  }
}

export const storeTripPointBatch = async (points: TripPointEvent[]) => {
  await ensureTripPointStorageReady()

  const results: TripPointBatchResult[] = []
  const affectedTripIds = new Set<number>()

  for (const point of points) {
    const result = await insertTripPoint(point)
    results.push(result)

    if (result.status !== "stored") {
      continue
    }

    const driverId = await resolveDriverIdFromIdentifier(point.driverId)
    if (driverId) {
      const tripId = point.tripId === undefined ? null : parsePositiveInteger(point.tripId)
      await upsertDriverLocation({
        driverId,
        tripId,
        lat: point.lat,
        lng: point.lng,
        speed: point.speed,
        heading: point.heading,
        accuracy: point.accuracy,
        recordedAt: new Date(point.ts).toISOString()
      })

      if (tripId) {
        affectedTripIds.add(tripId)
      }
    }
  }

  for (const tripId of affectedTripIds) {
    await rebuildTripPathForTrip(tripId)
  }

  return results
}

export const getRecentTripPoints = async (options?: {
  limit?: number
  driverId?: string
  tripId?: string
}) => {
  await ensureTripPointStorageReady()

  const requestedLimit = options?.limit ?? 100
  const limit = Math.max(1, Math.min(requestedLimit, 500))
  const clauses: string[] = []
  const params: unknown[] = []

  if (options?.driverId) {
    const driverId = await resolveDriverIdFromIdentifier(options.driverId)
    if (!driverId) {
      throw new Error("driverId must match an existing driver ID or driver code.")
    }
    params.push(driverId)
    clauses.push(`tp.driver_id = $${params.length}`)
  }

  if (options?.tripId) {
    const tripId = parsePositiveInteger(options.tripId)
    if (!tripId) {
      throw new Error("tripId must be a positive integer.")
    }
    params.push(tripId)
    clauses.push(`tp.trip_id = $${params.length}`)
  }

  params.push(limit)
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""

  const result = await query<TripPointRow>(
    `
      SELECT
        tp.dedup_key,
        tp.driver_id,
        tp.trip_id,
        tp.recorded_at,
        tp.lng,
        tp.lat,
        tp.speed,
        tp.heading,
        tp.accuracy,
        tp.created_at
      FROM public.trip_points tp
      ${whereClause}
      ORDER BY tp.recorded_at DESC
      LIMIT $${params.length}
    `,
    params
  )

  return result.rows.map(mapTripPoint)
}
