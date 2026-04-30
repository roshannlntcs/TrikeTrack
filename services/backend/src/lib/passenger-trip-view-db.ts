import { ensureDatabaseReady, query } from "./database"

type TripStatus = "scheduled" | "ongoing" | "completed" | "cancelled"

type TripContextRow = {
  qr_id: number
  qr_token: string
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  tricycle_id: number | null
  plate_no: string | null
}

type TripViewRow = {
  trip_id: number
  trip_status: TripStatus
  trip_start: Date
  trip_end: Date | null
  route_name: string | null
  route_id: number | null
  fare_amount: string | null
  driver_location_trip_id: number | null
  driver_location_latitude: number | null
  driver_location_longitude: number | null
  driver_location_speed: number | null
  driver_location_heading: number | null
  driver_location_accuracy: number | null
  driver_location_recorded_at: Date | null
  driver_location_updated_at: Date | null
  driver_location_is_online: boolean | null
  point_latitude: number | null
  point_longitude: number | null
  point_speed: number | null
  point_heading: number | null
  point_accuracy: number | null
  point_recorded_at: Date | null
}

type TripPathRow = {
  path_geojson: {
    geometry?: {
      coordinates?: Array<[number, number]>
    }
  } | null
}

type TripRoutePointRow = {
  longitude: number
  latitude: number
}

const BREADCRUMB_LIMIT = 8

export type PassengerTripView = {
  available: boolean
  driverId: number
  driverCode: string
  driverName: string
  qrId: number
  trip?: {
    tripId: number
    tripStatus: TripStatus
    routeId?: number
    routeName?: string
    startedAt: string
    endedAt?: string
    fareAmount?: number
    timerSeconds: number
    distanceKilometers: number
    speedKph?: number
    plateOrBodyNumber: string
    trackingStatus: "live" | "ended" | "last_known" | "waiting"
    lastUpdatedAt?: string
    location?: {
      latitude: number
      longitude: number
      heading?: number
      accuracy?: number
      recordedAt: string
      updatedAt?: string
      isOnline: boolean
    }
    breadcrumbs: Array<{
      latitude: number
      longitude: number
    }>
    finalRoute: {
      status: "ready" | "processing"
      coordinates: Array<[number, number]>
    }
  }
}

const haversineKilometers = (
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
) => {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const latitudeDelta = toRadians(end.latitude - start.latitude)
  const longitudeDelta = toRadians(end.longitude - start.longitude)
  const startLatitude = toRadians(start.latitude)
  const endLatitude = toRadians(end.latitude)

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2)

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const sumDistanceKilometers = (coordinates: Array<[number, number]>) => {
  let total = 0

  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1]
    const current = coordinates[index]
    total += haversineKilometers(
      { latitude: previous[1], longitude: previous[0] },
      { latitude: current[1], longitude: current[0] }
    )
  }

  return Number(total.toFixed(2))
}

const getTripContextByQrToken = async (qrToken: string) => {
  const result = await query<TripContextRow>(
    `
      SELECT
        qr.qr_id,
        qr.qr_token,
        d.driver_id,
        d.driver_code,
        d.first_name,
        d.last_name,
        tr.tricycle_id,
        tr.plate_no
      FROM public.qr_codes qr
      JOIN public.drivers d
        ON d.driver_id = qr.driver_id
      LEFT JOIN public.tricycles tr
        ON tr.tricycle_id = COALESCE(qr.tricycle_id, d.tricycle_id)
      WHERE qr.qr_token = $1
        AND qr.status = 'active'
        AND (qr.expires_at IS NULL OR qr.expires_at > NOW())
      LIMIT 1
    `,
    [qrToken]
  )

  return result.rows[0] ?? null
}

const getTripRow = async (driverId: number, preferredTripId?: number) => {
  const params: unknown[] = [driverId]
  let tripFilter = `t.trip_status::text IN ('active', 'ongoing')`

  if (preferredTripId) {
    params.push(preferredTripId)
    tripFilter = `t.trip_id = $${params.length}`
  }

  const result = await query<TripViewRow>(
    `
      SELECT
        t.trip_id,
        t.trip_status,
        t.trip_start,
        t.trip_end,
        r.route_id,
        r.origin || ' -> ' || r.destination AS route_name,
        t.fare_amount,
        dl.trip_id AS driver_location_trip_id,
        dl.latitude AS driver_location_latitude,
        dl.longitude AS driver_location_longitude,
        dl.speed AS driver_location_speed,
        dl.heading AS driver_location_heading,
        dl.accuracy AS driver_location_accuracy,
        dl.recorded_at AS driver_location_recorded_at,
        dl.updated_at AS driver_location_updated_at,
        dl.is_online AS driver_location_is_online,
        last_point.lat AS point_latitude,
        last_point.lng AS point_longitude,
        last_point.speed AS point_speed,
        last_point.heading AS point_heading,
        last_point.accuracy AS point_accuracy,
        last_point.recorded_at AS point_recorded_at
      FROM public.trips t
      LEFT JOIN public.routes r
        ON r.route_id = t.route_id
      LEFT JOIN public.driver_locations dl
        ON dl.driver_id = t.driver_id
      LEFT JOIN LATERAL (
        SELECT
          tp.lat,
          tp.lng,
          tp.speed,
          tp.heading,
          tp.accuracy,
          tp.recorded_at
        FROM public.trip_points tp
        WHERE tp.trip_id = t.trip_id
        ORDER BY tp.recorded_at DESC, tp.point_id DESC
        LIMIT 1
      ) last_point
        ON TRUE
      WHERE t.driver_id = $1
        AND ${tripFilter}
      ORDER BY
        CASE WHEN t.trip_status::text IN ('active', 'ongoing') THEN 0 ELSE 1 END,
        COALESCE(t.trip_end, t.trip_start) DESC,
        t.trip_id DESC
      LIMIT 1
    `,
    params
  )

  return result.rows[0] ?? null
}

const getBreadcrumbs = async (tripId: number) => {
  const result = await query<TripRoutePointRow>(
    `
      SELECT breadcrumb.longitude, breadcrumb.latitude
      FROM (
        SELECT
          tp.lng AS longitude,
          tp.lat AS latitude,
          tp.recorded_at
        FROM public.trip_points tp
        WHERE tp.trip_id = $1
        ORDER BY tp.recorded_at DESC, tp.point_id DESC
        LIMIT ${BREADCRUMB_LIMIT}
      ) breadcrumb
      ORDER BY breadcrumb.recorded_at ASC
    `,
    [tripId]
  )

  return result.rows.map((row) => ({
    latitude: Number(row.latitude),
    longitude: Number(row.longitude)
  }))
}

const getTripPathCoordinates = async (tripId: number) => {
  const result = await query<TripPathRow>(
    `
      SELECT tp.path_geojson
      FROM public.trip_paths tp
      WHERE tp.trip_id = $1
      LIMIT 1
    `,
    [tripId]
  )

  return result.rows[0]?.path_geojson?.geometry?.coordinates ?? []
}

const getFinalRouteCoordinates = async (tripId: number) => {
  const result = await query<TripRoutePointRow>(
    `
      SELECT trp.longitude, trp.latitude
      FROM public.trip_route_points trp
      WHERE trp.trip_id = $1
      ORDER BY trp.idx ASC
    `,
    [tripId]
  )

  return result.rows.map((row) => [Number(row.longitude), Number(row.latitude)] as [number, number])
}

export const getPassengerTripViewByQrToken = async (
  qrToken: string,
  preferredTripId?: number
): Promise<PassengerTripView | null> => {
  await ensureDatabaseReady()

  const tripContext = await getTripContextByQrToken(qrToken)
  if (!tripContext) {
    return null
  }

  const tripRow = await getTripRow(tripContext.driver_id, preferredTripId)
  if (!tripRow) {
    return {
      available: false,
      driverId: Number(tripContext.driver_id),
      driverCode: tripContext.driver_code,
      driverName: `${tripContext.first_name} ${tripContext.last_name}`,
      qrId: Number(tripContext.qr_id)
    }
  }

  const [breadcrumbs, pathCoordinates, finalRouteCoordinates] = await Promise.all([
    getBreadcrumbs(tripRow.trip_id),
    getTripPathCoordinates(tripRow.trip_id),
    tripRow.trip_status === "completed" ? getFinalRouteCoordinates(tripRow.trip_id) : Promise.resolve([])
  ])

  const fallbackLatitude = tripRow.point_latitude
  const fallbackLongitude = tripRow.point_longitude
  const location =
    tripRow.driver_location_trip_id === tripRow.trip_id &&
    tripRow.driver_location_latitude !== null &&
    tripRow.driver_location_longitude !== null &&
    tripRow.driver_location_recorded_at !== null
      ? {
          latitude: Number(tripRow.driver_location_latitude),
          longitude: Number(tripRow.driver_location_longitude),
          heading: tripRow.driver_location_heading ?? undefined,
          accuracy: tripRow.driver_location_accuracy ?? undefined,
          recordedAt: tripRow.driver_location_recorded_at.toISOString(),
          updatedAt: tripRow.driver_location_updated_at?.toISOString(),
          isOnline: tripRow.driver_location_is_online ?? false
        }
      : fallbackLatitude !== null && fallbackLongitude !== null && tripRow.point_recorded_at !== null
        ? {
            latitude: Number(fallbackLatitude),
            longitude: Number(fallbackLongitude),
            heading: tripRow.point_heading ?? undefined,
            accuracy: tripRow.point_accuracy ?? undefined,
            recordedAt: tripRow.point_recorded_at.toISOString(),
            isOnline: false
          }
        : undefined

  const now = Date.now()
  const tripStartMs = tripRow.trip_start.getTime()
  const tripEndMs = tripRow.trip_end?.getTime()
  const timerSeconds = Math.max(
    0,
    Math.round(((tripEndMs ?? now) - tripStartMs) / 1000)
  )

  let trackingStatus: PassengerTripView["trip"] extends infer T
    ? T extends { trackingStatus: infer U }
      ? U
      : never
    : never = "waiting"

  if (tripRow.trip_status === "completed") {
    trackingStatus = "ended"
  } else if (location?.isOnline) {
    trackingStatus = "live"
  } else if (location) {
    trackingStatus = "last_known"
  }

  return {
    available: true,
    driverId: Number(tripContext.driver_id),
    driverCode: tripContext.driver_code,
    driverName: `${tripContext.first_name} ${tripContext.last_name}`,
    qrId: Number(tripContext.qr_id),
    trip: {
      tripId: Number(tripRow.trip_id),
      tripStatus: tripRow.trip_status,
      routeId: tripRow.route_id === null ? undefined : Number(tripRow.route_id),
      routeName: tripRow.route_name ?? undefined,
      startedAt: tripRow.trip_start.toISOString(),
      endedAt: tripRow.trip_end?.toISOString(),
      fareAmount: tripRow.fare_amount === null ? undefined : Number(tripRow.fare_amount),
      timerSeconds,
      distanceKilometers: sumDistanceKilometers(pathCoordinates),
      speedKph:
        tripRow.driver_location_speed ??
        tripRow.point_speed ??
        undefined,
      plateOrBodyNumber:
        tripContext.plate_no?.trim() ||
        (tripContext.tricycle_id ? `Unit ${tripContext.tricycle_id}` : "Unavailable"),
      trackingStatus,
      lastUpdatedAt: location?.updatedAt ?? location?.recordedAt,
      location,
      breadcrumbs,
      finalRoute: {
        status:
          tripRow.trip_status === "completed" && finalRouteCoordinates.length >= 2
            ? "ready"
            : "processing",
        coordinates: finalRouteCoordinates
      }
    }
  }
}
