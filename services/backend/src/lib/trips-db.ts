import { ensureDatabaseReady, query } from "./database"
import { resolveDriverIdFromIdentifier } from "./driver-identifier-db"
import { markDriverLocationOffline } from "./driver-locations-db"
import { rebuildTripPathForTrip } from "./trip-paths-db"

export type TripStatus = "scheduled" | "ongoing" | "completed" | "cancelled"

export type StartTripInput = {
  driverId: string
  routeId: number
  tricycleId?: number
  tripStartTs?: number
}

export type EndTripInput = {
  tripId: number
  tripEndTs?: number
  fareAmount?: number
}

export type TripRecord = {
  tripId: number
  driverId: number
  tricycleId: number
  routeId: number
  tripStart: string
  tripEnd?: string
  durationMinutes?: number
  fareAmount?: number
  tripStatus: TripStatus
  createdAt: string
}

type DriverTripContextRow = {
  driver_id: number
  toda_id: number
  tricycle_id: number | null
  status: "active" | "inactive" | "suspended"
}

type RouteTripContextRow = {
  route_id: number
  toda_id: number
  status: "active" | "inactive" | "suspended"
  default_fare_amount: string | null
}

type TricycleTripContextRow = {
  tricycle_id: number
  toda_id: number
  status: "active" | "inactive" | "suspended"
}

type TripRow = {
  trip_id: number
  driver_id: number
  tricycle_id: number
  route_id: number
  trip_start: Date
  trip_end: Date | null
  duration_minutes: number | null
  fare_amount: string | null
  trip_status: TripStatus
  created_at: Date
}

const mapTrip = (row: TripRow): TripRecord => ({
  tripId: Number(row.trip_id),
  driverId: Number(row.driver_id),
  tricycleId: Number(row.tricycle_id),
  routeId: Number(row.route_id),
  tripStart: row.trip_start.toISOString(),
  tripEnd: row.trip_end?.toISOString(),
  durationMinutes: row.duration_minutes ?? undefined,
  fareAmount: row.fare_amount === null ? undefined : Number(row.fare_amount),
  tripStatus: row.trip_status,
  createdAt: row.created_at.toISOString()
})

const getDriverTripContext = async (driverIdentifier: string) => {
  const driverId = await resolveDriverIdFromIdentifier(driverIdentifier)
  if (!driverId) {
    throw new Error("Driver not found.")
  }

  const result = await query<DriverTripContextRow>(
    `
      SELECT
        d.driver_id,
        d.toda_id,
        d.tricycle_id,
        d.status
      FROM public.drivers d
      WHERE d.driver_id = $1
      LIMIT 1
    `,
    [driverId]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Driver not found.")
  }
  if (row.status !== "active") {
    throw new Error("Driver is not active.")
  }

  return row
}

const getRouteTripContext = async (routeId: number) => {
  const result = await query<RouteTripContextRow>(
    `
      SELECT
        r.route_id,
        r.toda_id,
        r.default_fare_amount,
        r.status
      FROM public.routes r
      WHERE r.route_id = $1
      LIMIT 1
    `,
    [routeId]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Route not found.")
  }
  if (row.status !== "active") {
    throw new Error("Route is not active.")
  }

  return row
}

const getTricycleTripContext = async (tricycleId: number) => {
  const result = await query<TricycleTripContextRow>(
    `
      SELECT
        tr.tricycle_id,
        tr.toda_id,
        tr.status
      FROM public.tricycles tr
      WHERE tr.tricycle_id = $1
      LIMIT 1
    `,
    [tricycleId]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Tricycle not found.")
  }
  if (row.status !== "active") {
    throw new Error("Tricycle is not active.")
  }

  return row
}

const getTripByIdRow = async (tripId: number) => {
  const result = await query<TripRow>(
    `
      SELECT
        t.trip_id,
        t.driver_id,
        t.tricycle_id,
        t.route_id,
        t.trip_start,
        t.trip_end,
        t.duration_minutes,
        t.fare_amount,
        t.trip_status,
        t.created_at
      FROM public.trips t
      WHERE t.trip_id = $1
      LIMIT 1
    `,
    [tripId]
  )

  return result.rows[0] ?? null
}

const ensureDriverHasNoOngoingTrip = async (driverId: number) => {
  const result = await query<{ trip_id: number }>(
    `
      SELECT t.trip_id
      FROM public.trips t
      WHERE t.driver_id = $1
        AND t.trip_status = 'ongoing'
      LIMIT 1
    `,
    [driverId]
  )

  if (result.rows[0]?.trip_id) {
    throw new Error("Driver already has an ongoing trip.")
  }
}

export const startTrip = async (input: StartTripInput) => {
  await ensureDatabaseReady()

  const driver = await getDriverTripContext(input.driverId)
  const route = await getRouteTripContext(input.routeId)
  const tricycleId = input.tricycleId ?? (driver.tricycle_id === null ? undefined : Number(driver.tricycle_id))

  if (!tricycleId) {
    throw new Error("Driver has no assigned tricycle. Provide tricycleId explicitly.")
  }

  const tricycle = await getTricycleTripContext(tricycleId)

  if (route.toda_id !== driver.toda_id) {
    throw new Error("Route does not belong to the driver's TODA.")
  }

  if (tricycle.toda_id !== driver.toda_id) {
    throw new Error("Tricycle does not belong to the driver's TODA.")
  }

  await ensureDriverHasNoOngoingTrip(driver.driver_id)

  const tripStartIso = new Date(input.tripStartTs ?? Date.now()).toISOString()

  const result = await query<TripRow>(
    `
      INSERT INTO public.trips (
        driver_id,
        tricycle_id,
        route_id,
        trip_start,
        fare_amount,
        trip_status
      )
      VALUES ($1, $2, $3, $4::timestamptz, $5, 'ongoing')
      RETURNING
        trip_id,
        driver_id,
        tricycle_id,
        route_id,
        trip_start,
        trip_end,
        duration_minutes,
        fare_amount,
        trip_status,
        created_at
    `,
    [
      driver.driver_id,
      tricycleId,
      route.route_id,
      tripStartIso,
      route.default_fare_amount === null ? null : Number(route.default_fare_amount)
    ]
  )

  return mapTrip(result.rows[0])
}

export const endTrip = async (input: EndTripInput) => {
  await ensureDatabaseReady()

  const existingTrip = await getTripByIdRow(input.tripId)
  if (!existingTrip) {
    throw new Error("Trip not found.")
  }

  if (existingTrip.trip_status === "completed") {
    return mapTrip(existingTrip)
  }

  if (existingTrip.trip_status === "cancelled") {
    throw new Error("Cancelled trips cannot be completed.")
  }

  const tripEnd = new Date(input.tripEndTs ?? Date.now())
  const tripStartMs = existingTrip.trip_start.getTime()
  const tripEndMs = tripEnd.getTime()

  if (tripEndMs < tripStartMs) {
    throw new Error("tripEndTs cannot be earlier than trip start.")
  }

  const durationMinutes = Math.max(0, Math.round((tripEndMs - tripStartMs) / 60000))

  const result = await query<TripRow>(
    `
      UPDATE public.trips
      SET
        trip_end = $2::timestamptz,
        duration_minutes = $3,
        fare_amount = COALESCE($4, fare_amount),
        trip_status = 'completed'
      WHERE trip_id = $1
      RETURNING
        trip_id,
        driver_id,
        tricycle_id,
        route_id,
        trip_start,
        trip_end,
        duration_minutes,
        fare_amount,
        trip_status,
        created_at
    `,
    [
      input.tripId,
      tripEnd.toISOString(),
      durationMinutes,
      input.fareAmount ?? null
    ]
  )

  const row = result.rows[0]
  await markDriverLocationOffline(row.driver_id, row.trip_end?.toISOString())
  await rebuildTripPathForTrip(row.trip_id)

  return mapTrip(row)
}
