import { NextResponse } from "next/server"
import { resolveDriverIdFromIdentifier } from "../../../lib/driver-identifier-db"
import { upsertDriverLocation } from "../../../lib/driver-locations-db"

const asDriverIdentifier = (value: unknown) =>
  typeof value === "string"
    ? value.trim() || null
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null

const asFiniteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const asOptionalFiniteNumber = (value: unknown) => {
  if (value === undefined) return undefined
  return asFiniteNumber(value)
}

const asOptionalPositiveInteger = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Request body must be valid JSON."
      },
      { status: 400 }
    )
  }

  const raw = body as Record<string, unknown>
  const driverIdentifier = asDriverIdentifier(raw.driverId)
  const ts = asFiniteNumber(raw.ts)
  const lng = asFiniteNumber(raw.lng)
  const lat = asFiniteNumber(raw.lat)
  const speed = asOptionalFiniteNumber(raw.speed)
  const heading = asOptionalFiniteNumber(raw.heading)
  const accuracy = asOptionalFiniteNumber(raw.accuracy)
  const tripId = asOptionalPositiveInteger(raw.tripId)

  if (!driverIdentifier || ts === null || lng === null || lat === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "Expected { driverId, ts, lng, lat, speed?, heading?, accuracy?, tripId? }."
      },
      { status: 400 }
    )
  }

  if (raw.speed !== undefined && speed === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "speed must be a finite number when provided."
      },
      { status: 400 }
    )
  }

  if (raw.heading !== undefined && heading === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "heading must be a finite number when provided."
      },
      { status: 400 }
    )
  }

  if (raw.accuracy !== undefined && accuracy === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "accuracy must be a finite number when provided."
      },
      { status: 400 }
    )
  }

  if (raw.tripId !== undefined && tripId === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "tripId must be a positive integer when provided."
      },
      { status: 400 }
    )
  }

  const driverId = await resolveDriverIdFromIdentifier(driverIdentifier)
  if (!driverId) {
    return NextResponse.json(
      {
        ok: false,
        message: "Driver not found."
      },
      { status: 404 }
    )
  }

  try {
    const recordedAt = new Date(ts).toISOString()

    await upsertDriverLocation({
      driverId,
      tripId: tripId ?? null,
      lat,
      lng,
      speed: speed ?? undefined,
      heading: heading ?? undefined,
      accuracy: accuracy ?? undefined,
      recordedAt
    })

    return NextResponse.json({
      ok: true,
      data: {
        driverId,
        tripId: tripId ?? null,
        recordedAt
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to store driver location."
      },
      { status: 500 }
    )
  }
}
