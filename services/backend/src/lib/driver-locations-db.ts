import { ensureDatabaseReady, query } from "./database"

export type UpsertDriverLocationInput = {
  driverId: number
  tripId?: number | null
  lat: number
  lng: number
  speed?: number
  heading?: number
  accuracy?: number
  recordedAt: string
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackDriverLocationsReady: Promise<void> | undefined
}

const ensureDriverLocationsSchemaReady = async () => {
  await ensureDatabaseReady()

  await query(`
    CREATE TABLE IF NOT EXISTS public.driver_locations (
      driver_id bigint PRIMARY KEY REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
      driver_code text NOT NULL,
      trip_id bigint REFERENCES public.trips(trip_id) ON DELETE SET NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      speed double precision,
      heading double precision,
      accuracy double precision,
      recorded_at timestamptz NOT NULL,
      is_online boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_driver_locations_trip_id
    ON public.driver_locations(trip_id)
  `)
  await query(`
    CREATE INDEX IF NOT EXISTS idx_driver_locations_recorded_at
    ON public.driver_locations(recorded_at DESC)
  `)
}

export const ensureDriverLocationsReady = () => {
  if (!globalThis.__triketrackDriverLocationsReady) {
    globalThis.__triketrackDriverLocationsReady = ensureDriverLocationsSchemaReady()
  }

  return globalThis.__triketrackDriverLocationsReady
}

export const upsertDriverLocation = async (input: UpsertDriverLocationInput) => {
  await ensureDriverLocationsReady()

  await query(
    `
      INSERT INTO public.driver_locations (
        driver_id,
        driver_code,
        trip_id,
        latitude,
        longitude,
        speed,
        heading,
        accuracy,
        recorded_at,
        is_online,
        updated_at
      )
      SELECT
        d.driver_id,
        d.driver_code,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::timestamptz,
        true,
        now()
      FROM public.drivers d
      WHERE d.driver_id = $1
      ON CONFLICT (driver_id) DO UPDATE
      SET
        driver_code = EXCLUDED.driver_code,
        trip_id = EXCLUDED.trip_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        speed = EXCLUDED.speed,
        heading = EXCLUDED.heading,
        accuracy = EXCLUDED.accuracy,
        recorded_at = EXCLUDED.recorded_at,
        is_online = EXCLUDED.is_online,
        updated_at = now()
      WHERE public.driver_locations.recorded_at <= EXCLUDED.recorded_at
    `,
    [
      input.driverId,
      input.tripId ?? null,
      input.lat,
      input.lng,
      input.speed ?? null,
      input.heading ?? null,
      input.accuracy ?? null,
      input.recordedAt
    ]
  )
}

export const markDriverLocationOffline = async (driverId: number, recordedAt?: string) => {
  await ensureDriverLocationsReady()

  await query(
    `
      UPDATE public.driver_locations
      SET
        trip_id = NULL,
        is_online = false,
        updated_at = now(),
        recorded_at = COALESCE($2::timestamptz, recorded_at)
      WHERE driver_id = $1
    `,
    [driverId, recordedAt ?? null]
  )
}
