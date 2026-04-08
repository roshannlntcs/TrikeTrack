import { NextResponse } from "next/server"
import {
  storeTripPointBatch,
  type TripPointBatchResult
} from "../../../../lib/trip-points-db"
import type { TripPointEvent } from "../../../../lib/operational-types"

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const isTripPointEvent = (value: unknown): value is TripPointEvent => {
  if (!value || typeof value !== "object") return false
  const raw = value as Record<string, unknown>

  if (raw.type !== "trip_point") return false
  if (!isNonEmptyString(raw.driverId)) return false
  if (!isFiniteNumber(raw.ts)) return false
  if (!isFiniteNumber(raw.lng) || !isFiniteNumber(raw.lat)) return false
  if (raw.speed !== undefined && !isFiniteNumber(raw.speed)) return false
  if (raw.heading !== undefined && !isFiniteNumber(raw.heading)) return false
  if (raw.accuracy !== undefined && !isFiniteNumber(raw.accuracy)) return false
  if (raw.tripId !== undefined && !isNonEmptyString(raw.tripId)) return false

  return true
}

const getCandidateDedupKey = (candidate: unknown, fallback: string) => {
  if (!candidate || typeof candidate !== "object") return fallback
  const raw = candidate as Record<string, unknown>
  if (!isNonEmptyString(raw.driverId)) return fallback
  if (!isFiniteNumber(raw.ts)) return fallback
  return `${raw.driverId}-${raw.ts}`
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        error: "INVALID_JSON",
        message: "Request body must be valid JSON."
      },
      { status: 400 }
    )
  }

  const points = (body as Record<string, unknown>)?.points
  if (!Array.isArray(points)) {
    return NextResponse.json(
      {
        error: "INVALID_PAYLOAD",
        message: "Expected { points: TripPointEvent[] }."
      },
      { status: 400 }
    )
  }

  const accepted: TripPointEvent[] = []
  const results: TripPointBatchResult[] = []

  for (const candidate of points) {
    if (!isTripPointEvent(candidate)) {
      results.push({
        dedupKey: getCandidateDedupKey(candidate, `invalid-${results.length + 1}`),
        status: "rejected",
        reason: "INVALID_SHAPE"
      })
      continue
    }

    accepted.push(candidate)
  }

  try {
    if (accepted.length > 0) {
      const storedResults = await storeTripPointBatch(accepted)
      results.push(...storedResults)
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "TRIP_POINT_STORAGE_FAILED",
        message: error instanceof Error ? error.message : "Unable to store trip points."
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    results,
    totals: {
      stored: results.filter((result) => result.status === "stored").length,
      duplicate: results.filter((result) => result.status === "duplicate").length,
      rejected: results.filter((result) => result.status === "rejected").length
    }
  })
}
