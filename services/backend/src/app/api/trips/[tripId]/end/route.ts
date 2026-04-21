import { NextResponse } from "next/server"
import { endTrip } from "../../../../../lib/trips-db"

const asOptionalFiniteNumber = (value: unknown) => {
  if (value === undefined) return undefined
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

type TripEndRouteContext = {
  params: {
    tripId: string
  }
}

export async function POST(request: Request, context: TripEndRouteContext) {
  const tripId = Number(context.params.tripId)
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json(
      { ok: false, message: "tripId must be a positive integer." },
      { status: 400 }
    )
  }

  let body: unknown = {}
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be valid JSON." },
      { status: 400 }
    )
  }

  const raw = body as Record<string, unknown>
  const tripEndTs = asOptionalFiniteNumber(raw.tripEndTs)
  const fareAmount = asOptionalFiniteNumber(raw.fareAmount)

  if (tripEndTs === null) {
    return NextResponse.json(
      { ok: false, message: "tripEndTs must be a finite number when provided." },
      { status: 400 }
    )
  }

  if (fareAmount === null) {
    return NextResponse.json(
      { ok: false, message: "fareAmount must be a finite number when provided." },
      { status: 400 }
    )
  }

  try {
    const trip = await endTrip({
      tripId,
      tripEndTs,
      fareAmount
    })

    return NextResponse.json({
      ok: true,
      data: trip
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to end trip."
      },
      { status: 400 }
    )
  }
}
