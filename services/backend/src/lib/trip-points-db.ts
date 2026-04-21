import type { TripPointEvent } from "./operational-types"
import { ensureDatabaseReady, query } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"
import { upsertDriverLocation } from "./driver-locations-db"
import { rebuildTripPathForTrip } from "./trip-paths-db"
import { storeGeofenceDeviationViolation } from "./violations-db"

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

type TripRouteContextRow = {
  trip_id: number
  driver_id: number
  tricycle_id: number | null
  route_id: number
  origin: string
  destination: string
  geofence_geojson: unknown | null
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

type PolygonGeometry = {
  type: "Polygon"
  coordinates: number[][][]
}

type MultiPolygonGeometry = {
  type: "MultiPolygon"
  coordinates: number[][][][]
}

type GeoJsonLike =
  | { type: "Feature"; geometry?: GeoJsonLike | null }
  | { type: "FeatureCollection"; features?: GeoJsonLike[] }
  | PolygonGeometry
  | MultiPolygonGeometry

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

const isCoordinate = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1])

const isRing = (value: unknown): value is Array<[number, number]> =>
  Array.isArray(value) && value.length >= 4 && value.every(isCoordinate)

const isPolygonCoordinates = (value: unknown): value is Array<Array<[number, number]>> =>
  Array.isArray(value) && value.length > 0 && value.every(isRing)

const isMultiPolygonCoordinates = (
  value: unknown
): value is Array<Array<Array<[number, number]>>> =>
  Array.isArray(value) && value.length > 0 && value.every(isPolygonCoordinates)

const extractPolygons = (geojson: unknown): Array<Array<Array<[number, number]>>> => {
  if (!geojson || typeof geojson !== "object") return []
  const candidate = geojson as GeoJsonLike

  if (candidate.type === "Feature") {
    return extractPolygons(candidate.geometry)
  }

  if (candidate.type === "FeatureCollection") {
    return (candidate.features ?? []).flatMap(extractPolygons)
  }

  if (candidate.type === "Polygon" && isPolygonCoordinates(candidate.coordinates)) {
    return [candidate.coordinates]
  }

  if (
    candidate.type === "MultiPolygon" &&
    isMultiPolygonCoordinates(candidate.coordinates)
  ) {
    return candidate.coordinates
  }

  return []
}

const isPointInRing = (lng: number, lat: number, ring: Array<[number, number]>) => {
  let inside = false
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current]
    const [previousLng, previousLat] = ring[previous]
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng <
        ((previousLng - currentLng) * (lat - currentLat)) /
          (previousLat - currentLat) +
          currentLng

    if (intersects) inside = !inside
  }
  return inside
}

const isPointInPolygon = (
  lng: number,
  lat: number,
  polygon: Array<Array<[number, number]>>
) => {
  const [outerRing, ...holes] = polygon
  if (!outerRing || !isPointInRing(lng, lat, outerRing)) return false
  return holes.every((hole) => !isPointInRing(lng, lat, hole))
}

const getTripRouteContext = async (tripId: number, driverId: number) => {
  const result = await query<TripRouteContextRow>(
    `
      SELECT
        t.trip_id,
        t.driver_id,
        t.tricycle_id,
        r.route_id,
        r.origin,
        r.destination,
        r.geofence_geojson
      FROM public.trips t
      JOIN public.routes r
        ON r.route_id = t.route_id
      WHERE t.trip_id = $1
        AND t.driver_id = $2
      LIMIT 1
    `,
    [tripId, driverId]
  )

  return result.rows[0] ?? null
}

const maybeStoreGeofenceViolation = async (
  point: TripPointEvent,
  driverId: number,
  tripId: number,
  routeContext: TripRouteContextRow
) => {
  const polygons = extractPolygons(routeContext.geofence_geojson)
  if (polygons.length === 0) return

  const insideAnyPolygon = polygons.some((polygon) =>
    isPointInPolygon(point.lng, point.lat, polygon)
  )
  if (insideAnyPolygon) return

  const minuteBucket = Math.floor(point.ts / 60000)
  await storeGeofenceDeviationViolation({
    dedupeKey: `geofence:${tripId}:${driverId}:${minuteBucket}`,
    driverId,
    tripId,
    routeId: routeContext.route_id,
    tricycleId: routeContext.tricycle_id,
    ts: point.ts,
    lng: point.lng,
    lat: point.lat,
    routeLabel: `${routeContext.origin} -> ${routeContext.destination}`
  })
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
  const tripRouteContexts = new Map<number, TripRouteContextRow | null>()

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
        if (!tripRouteContexts.has(tripId)) {
          tripRouteContexts.set(tripId, await getTripRouteContext(tripId, driverId))
        }
        const routeContext = tripRouteContexts.get(tripId)
        if (routeContext) {
          await maybeStoreGeofenceViolation(point, driverId, tripId, routeContext)
        }
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
