import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../../../lib/admin-session"
import { query } from "../../../../../../lib/database"
import {
  getTripPathByTripId,
  rebuildTripPathForTrip
} from "../../../../../../lib/trip-paths-db"

type TripPathRouteContext = {
  params: {
    tripId: string
  }
}

type TripScopeRow = {
  trip_id: number
}

type TripRouteTraceRow = {
  route_trace_geojson: unknown
  raw_gps_point_count: number | null
  matched_point_count: number | null
  trip_start: Date
  trip_end: Date | null
  updated_at?: Date | null
}

type TripPathLocationRow = {
  recorded_at: Date
  lat: number
  lng: number
  speed: number | null
}

const isLngLatPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1])

const normalizeRouteTraceGeojson = (value: unknown) => {
  if (!value || typeof value !== "object") return null
  const candidate = value as Record<string, unknown>
  const geometry =
    candidate.type === "Feature" && candidate.geometry && typeof candidate.geometry === "object"
      ? (candidate.geometry as Record<string, unknown>)
      : candidate

  if (geometry.type !== "LineString" || !Array.isArray(geometry.coordinates)) {
    return null
  }

  const coordinates = geometry.coordinates.filter(isLngLatPair)
  if (coordinates.length < 2) return null

  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates
    },
    properties: {
      source: "matched_route_trace"
    }
  }
}

const getSyncedTripRouteTrace = async (tripId: number) => {
  const result = await query<TripRouteTraceRow>(
    `
      SELECT
        tp.route_trace_geojson,
        tp.raw_gps_point_count,
        tp.matched_point_count,
        tp.trip_start,
        tp.trip_end,
        tp.created_at AS updated_at
      FROM public.trips tp
      WHERE tp.trip_id = $1
      LIMIT 1
    `,
    [tripId]
  )

  const row = result.rows[0]
  if (!row) return null

  const pathGeojson = normalizeRouteTraceGeojson(row.route_trace_geojson)
  if (!pathGeojson) return null

  const rawPointCount =
    typeof row.raw_gps_point_count === "number" && row.raw_gps_point_count > 0
      ? Number(row.raw_gps_point_count)
      : pathGeojson.geometry.coordinates.length
  const matchedPointCount =
    typeof row.matched_point_count === "number" && row.matched_point_count > 0
      ? Number(row.matched_point_count)
      : pathGeojson.geometry.coordinates.length

  return {
    tripPathId: 0,
    tripId,
    pointCount: rawPointCount,
    rawPointCount,
    matchedPointCount,
    pathGeojson,
    startedAt: row.trip_start.toISOString(),
    endedAt: row.trip_end?.toISOString(),
    updatedAt: (row.updated_at ?? row.trip_end ?? row.trip_start).toISOString()
  }
}

const isRawTripPath = (tripPath: { pathGeojson: unknown }) => {
  if (!tripPath || typeof tripPath !== "object") return false
  const candidate = tripPath.pathGeojson as Record<string, unknown>
  const properties =
    candidate && typeof candidate === "object" && "properties" in candidate
      ? (candidate.properties as Record<string, unknown>)
      : null

  return properties?.source === "raw_gps_points"
}

const canReadTripPath = async (
  tripId: number,
  profile: {
    role: "superadmin" | "barangay_admin" | "toda_admin"
    barangayId?: number
    todaId?: number
  }
) => {
  const clauses = ["tp.trip_id = $1"]
  const params: unknown[] = [tripId]

  if (profile.role === "barangay_admin") {
    if (!profile.barangayId) return false
    params.push(profile.barangayId)
    clauses.push(`b.barangay_id = $${params.length}`)
  }

  if (profile.role === "toda_admin") {
    if (!profile.todaId) return false
    params.push(profile.todaId)
    clauses.push(`td.toda_id = $${params.length}`)
  }

  const result = await query<TripScopeRow>(
    `
      SELECT tp.trip_id
      FROM public.trips tp
      JOIN public.routes r
        ON r.route_id = tp.route_id
      JOIN public.todas td
        ON td.toda_id = r.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      WHERE ${clauses.join(" AND ")}
      LIMIT 1
    `,
    params
  )

  return Boolean(result.rows[0]?.trip_id)
}

const getTripSavedLocations = async (tripId: number) => {
  const result = await query<TripPathLocationRow>(
    `
      SELECT
        tp.recorded_at,
        tp.lat,
        tp.lng,
        tp.speed
      FROM public.trip_points tp
      WHERE tp.trip_id = $1
      ORDER BY tp.recorded_at ASC, tp.point_id ASC
      LIMIT 500
    `,
    [tripId]
  )

  return result.rows.map((row, index) => ({
    index,
    recordedAt: row.recorded_at.toISOString(),
    latitude: Number(row.lat),
    longitude: Number(row.lng),
    speed: row.speed === null ? undefined : Number(row.speed)
  }))
}

export async function GET(request: Request, context: TripPathRouteContext) {
  const tripId = Number(context.params.tripId)
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json(
      { ok: false, message: "tripId must be a positive integer." },
      { status: 400 }
    )
  }

  const session = await requireAdminSession(request)
  if (session.response) return session.response

  const allowed = await canReadTripPath(tripId, session.profile)
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Trip not found for this admin scope." },
      { status: 404 }
    )
  }

  try {
    const existingPath = await getTripPathByTripId(tripId)
    const syncedTrace = await getSyncedTripRouteTrace(tripId)

    let data = existingPath

    if (existingPath && isRawTripPath(existingPath)) {
      const rebuiltPath = await rebuildTripPathForTrip(tripId)
      data = rebuiltPath ?? existingPath
    }

    if (!data) {
      data = (await rebuildTripPathForTrip(tripId)) ?? syncedTrace
    }

    if (!data) {
      return NextResponse.json({ ok: false, message: "No trip path data available." }, { status: 404 })
    }

    const savedLocations = await getTripSavedLocations(tripId)

    return NextResponse.json({
      ok: true,
      data: {
        ...data,
        savedLocations
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to load trip path."
      },
      { status: 500 }
    )
  }
}
