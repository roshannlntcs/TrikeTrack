import { NextResponse } from "next/server"
import { resolveDriverIdFromIdentifier } from "../../../../lib/driver-identifier-db"
import { markDriverLocationOffline } from "../../../../lib/driver-locations-db"

const asDriverIdentifier = (value: unknown) =>
  typeof value === "string"
    ? value.trim() || null
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : null

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
      {
        ok: false,
        message: "Request body must be valid JSON."
      },
      { status: 400 }
    )
  }

  const raw = body as Record<string, unknown>
  const driverIdentifier = asDriverIdentifier(raw.driverId)
  const ts = asOptionalFiniteNumber(raw.ts)

  if (!driverIdentifier) {
    return NextResponse.json(
      {
        ok: false,
        message: "Expected { driverId, ts? }."
      },
      { status: 400 }
    )
  }

  if (raw.ts !== undefined && ts === null) {
    return NextResponse.json(
      {
        ok: false,
        message: "ts must be a finite number when provided."
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
    const recordedAt =
      typeof ts === "number" ? new Date(ts).toISOString() : undefined
    await markDriverLocationOffline(driverId, recordedAt)

    return NextResponse.json({
      ok: true,
      data: {
        driverId,
        recordedAt: recordedAt ?? null
      }
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to mark driver location offline."
      },
      { status: 500 }
    )
  }
}
