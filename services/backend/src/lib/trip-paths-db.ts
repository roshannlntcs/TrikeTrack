import { ensureDatabaseReady, query } from "./database"
import { matchTripGPSToRoads, shouldAttemptMatching } from "./osrm-matching"
import { reverseGeocodeLocationName } from "./reverse-geocode"

type TripPathPointRow = {
  recorded_at: Date
  lng: number
  lat: number
}

type StoredTripPathRow = {
  trip_path_id: number
  trip_id: number
  point_count: number
  path_geojson: unknown
  started_at: Date | null
  ended_at: Date | null
  start_location_name: string | null
  end_location_name: string | null
  updated_at: Date
}

export type StoredTripPath = {
  tripPathId: number
  tripId: number
  pointCount: number
  pathGeojson: unknown
  startedAt?: string
  endedAt?: string
  startLocationName?: string
  endLocationName?: string
  updatedAt: string
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackTripPathsReady: Promise<void> | undefined
}

const ensureTripPathsSchemaReady = async () => {
  await ensureDatabaseReady()

  await query(`
    CREATE TABLE IF NOT EXISTS public.trip_paths (
      trip_path_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      trip_id bigint NOT NULL UNIQUE REFERENCES public.trips(trip_id) ON DELETE CASCADE,
      point_count integer NOT NULL DEFAULT 0,
      path_geojson jsonb NOT NULL,
      started_at timestamptz,
      ended_at timestamptz,
      start_location_name text,
      end_location_name text,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    ALTER TABLE public.trip_paths
      ADD COLUMN IF NOT EXISTS start_location_name text,
      ADD COLUMN IF NOT EXISTS end_location_name text
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_trip_paths_updated_at
    ON public.trip_paths(updated_at DESC)
  `)
}

export const ensureTripPathsReady = () => {
  if (!globalThis.__triketrackTripPathsReady) {
    globalThis.__triketrackTripPathsReady = ensureTripPathsSchemaReady()
  }

  return globalThis.__triketrackTripPathsReady
}

const mapTripPath = (row: StoredTripPathRow): StoredTripPath => ({
  tripPathId: Number(row.trip_path_id),
  tripId: Number(row.trip_id),
  pointCount: Number(row.point_count),
  pathGeojson: row.path_geojson,
  startedAt: row.started_at?.toISOString(),
  endedAt: row.ended_at?.toISOString(),
  startLocationName: row.start_location_name ?? undefined,
  endLocationName: row.end_location_name ?? undefined,
  updatedAt: row.updated_at.toISOString()
})

const dedupeConsecutiveCoordinates = (coordinates: Array<[number, number]>) => {
  const next: Array<[number, number]> = []

  for (const coordinate of coordinates) {
    const previous = next[next.length - 1]
    if (previous && previous[0] === coordinate[0] && previous[1] === coordinate[1]) {
      continue
    }
    next.push(coordinate)
  }

  return next
}

export const rebuildTripPathForTrip = async (tripId: number) => {
  await ensureTripPathsReady()

  const result = await query<TripPathPointRow>(
    `
      SELECT
        tp.recorded_at,
        tp.lng,
        tp.lat
      FROM public.trip_points tp
      WHERE tp.trip_id = $1
      ORDER BY tp.recorded_at ASC, tp.point_id ASC
    `,
    [tripId]
  )

  const orderedCoordinates = dedupeConsecutiveCoordinates(
    result.rows.map((row) => [row.lng, row.lat] as [number, number])
  )

  if (orderedCoordinates.length < 2) {
    await query("DELETE FROM public.trip_paths WHERE trip_id = $1", [tripId])
    return null
  }

  const startedAt = result.rows[0]?.recorded_at?.toISOString() ?? null
  const endedAt = result.rows[result.rows.length - 1]?.recorded_at?.toISOString() ?? null
  const [startLng, startLat] = orderedCoordinates[0]
  const [endLng, endLat] = orderedCoordinates[orderedCoordinates.length - 1]
  const [startLocationName, endLocationName] = await Promise.all([
    reverseGeocodeLocationName({
      latitude: startLat,
      longitude: startLng,
      fallbackLabel: "Start location name unavailable"
    }),
    reverseGeocodeLocationName({
      latitude: endLat,
      longitude: endLng,
      fallbackLabel: "End location name unavailable"
    })
  ])

  // Attempt OSRM map matching for better road-aligned route
  let finalCoordinates = orderedCoordinates
  let routeSource = "raw_gps_points"

  try {
    const gpsPoints = result.rows.map((row) => ({
      latitude: row.lat,
      longitude: row.lng,
      timestamp: row.recorded_at.getTime()
    }))

    if (shouldAttemptMatching(gpsPoints)) {
      const matchedRoute = await matchTripGPSToRoads(gpsPoints)
      if (matchedRoute && matchedRoute.geometry.coordinates.length >= 2) {
        finalCoordinates = matchedRoute.geometry.coordinates
        routeSource = "osrm_matched_route"
        console.log(`[OSRM] Trip ${tripId}: Matched ${gpsPoints.length} GPS points to ${finalCoordinates.length} road points`)
      }
    }
  } catch (error) {
    // If OSRM matching fails, log and fallback to raw coordinates
    console.warn(`[OSRM] Trip ${tripId}: Map matching failed, using raw GPS points:`, error instanceof Error ? error.message : error)
  }

  const pathGeojson = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: finalCoordinates
    },
    properties: {
      tripId,
      pointCount: finalCoordinates.length,
      source: routeSource,
      rawPointCount: orderedCoordinates.length,
      matchedAt: routeSource === "osrm_matched_route" ? new Date().toISOString() : null
    }
  }

  const upsertResult = await query<StoredTripPathRow>(
    `
      INSERT INTO public.trip_paths (
        trip_id,
        point_count,
        path_geojson,
        started_at,
        ended_at,
        start_location_name,
        end_location_name,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4::timestamptz, $5::timestamptz, $6, $7, now())
      ON CONFLICT (trip_id) DO UPDATE
      SET
        point_count = EXCLUDED.point_count,
        path_geojson = EXCLUDED.path_geojson,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at,
        start_location_name = EXCLUDED.start_location_name,
        end_location_name = EXCLUDED.end_location_name,
        updated_at = now()
      RETURNING
        trip_path_id,
        trip_id,
        point_count,
        path_geojson,
        started_at,
        ended_at,
        start_location_name,
        end_location_name,
        updated_at
    `,
    [
      tripId,
      finalCoordinates.length,
      JSON.stringify(pathGeojson),
      startedAt,
      endedAt,
      startLocationName,
      endLocationName
    ]
  )

  const row = upsertResult.rows[0]
  return row ? mapTripPath(row) : null
}

export const getTripPathByTripId = async (tripId: number) => {
  await ensureTripPathsReady()

  const result = await query<StoredTripPathRow>(
    `
      SELECT
        tp.trip_path_id,
        tp.trip_id,
        tp.point_count,
        tp.path_geojson,
        tp.started_at,
        tp.ended_at,
        tp.start_location_name,
        tp.end_location_name,
        tp.updated_at
      FROM public.trip_paths tp
      WHERE tp.trip_id = $1
      LIMIT 1
    `,
    [tripId]
  )

  const row = result.rows[0]
  return row ? mapTripPath(row) : null
}
