import { NextResponse } from "next/server"
import { startTrip } from "../../../../lib/trips-db"

const asDriverIdentifier = (value: unknown) =>
  typeof value === "string"
    ? value.trim() || null
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null

const asPositiveInteger = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const asOptionalFiniteNumber = (value: unknown) => {
  if (value === undefined) return undefined
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be valid JSON." },
      { status: 400 }
    )
  }

  const raw = body as Record<string, unknown>
  const driverId = asDriverIdentifier(raw.driverId)
  const routeId = asPositiveInteger(raw.routeId)
  const tricycleIdRaw =
    raw.tricycleId === undefined ? undefined : asPositiveInteger(raw.tricycleId)
  const tricycleId = tricycleIdRaw ?? undefined
  const tripStartTs = asOptionalFiniteNumber(raw.tripStartTs)

  if (!driverId || !routeId) {
    return NextResponse.json(
      { ok: false, message: "Expected { driverId, routeId, tricycleId?, tripStartTs? }." },
      { status: 400 }
    )
  }

  if (raw.tricycleId !== undefined && !tricycleIdRaw) {
    return NextResponse.json(
      { ok: false, message: "tricycleId must be a positive integer when provided." },
      { status: 400 }
    )
  }

  if (tripStartTs === null) {
    return NextResponse.json(
      { ok: false, message: "tripStartTs must be a finite number when provided." },
      { status: 400 }
    )
  }

  try {
    const trip = await startTrip({
      driverId,
      routeId,
      tricycleId,
      tripStartTs
    })

    return NextResponse.json({
      ok: true,
      data: trip
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to start trip."
      },
      { status: 400 }
    )
  }
}
