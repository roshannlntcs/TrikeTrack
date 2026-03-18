import { NextResponse } from "next/server"
import {
  storeViolationBatch,
  type ViolationBatchItem,
  type ViolationBatchResult
} from "../../../../lib/violations-db"

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const isViolationBatchItem = (value: unknown): value is ViolationBatchItem => {
  if (!value || typeof value !== "object") return false
  const raw = value as Record<string, unknown>
  if (!isNonEmptyString(raw.id)) return false
  if (raw.type !== "violation") return false
  if (!isNonEmptyString(raw.driverId)) return false
  if (!isFiniteNumber(raw.ts)) return false
  if (!isFiniteNumber(raw.lng) || !isFiniteNumber(raw.lat)) return false
  if (raw.reason !== "OUTSIDE_ROUTE_CORRIDOR") return false
  if (!isNonEmptyString(raw.routeId)) return false
  if (raw.speed !== undefined && !isFiniteNumber(raw.speed)) return false
  if (raw.heading !== undefined && !isFiniteNumber(raw.heading)) return false
  if (raw.accuracy !== undefined && !isFiniteNumber(raw.accuracy)) return false
  return true
}

const getCandidateId = (candidate: unknown, fallbackId: string) => {
  if (!candidate || typeof candidate !== "object") return fallbackId
  const value = (candidate as Record<string, unknown>).id
  return isNonEmptyString(value) ? value : fallbackId
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

  const violations = (body as Record<string, unknown>)?.violations
  if (!Array.isArray(violations)) {
    return NextResponse.json(
      {
        error: "INVALID_PAYLOAD",
        message: "Expected { violations: ViolationBatchItem[] }."
      },
      { status: 400 }
    )
  }

  const results: ViolationBatchResult[] = []
  const accepted: ViolationBatchItem[] = []

  for (const candidate of violations) {
    const candidateId = getCandidateId(candidate, `invalid-${results.length + 1}`)

    if (!isViolationBatchItem(candidate)) {
      results.push({
        id: candidateId,
        status: "rejected",
        reason: "INVALID_SHAPE"
      })
      continue
    }

    accepted.push(candidate)
  }

  if (accepted.length > 0) {
    const storedResults = await storeViolationBatch(accepted)
    results.push(...storedResults)
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
