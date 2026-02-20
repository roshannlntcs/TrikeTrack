import { NextResponse } from "next/server"

type ViolationBatchItem = {
  id: string
  type: "violation"
  driverId: string
  ts: number
  lng: number
  lat: number
  reason: "OUTSIDE_ROUTE_CORRIDOR"
  routeId: string
  speed?: number
  heading?: number
  accuracy?: number
}

type ViolationStoreItem = ViolationBatchItem & {
  storedAt: number
}

type ViolationBatchResult = {
  id: string
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}

type ViolationStore = {
  keys: Set<string>
  items: ViolationStoreItem[]
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackViolationStore: ViolationStore | undefined
}

const getViolationStore = (): ViolationStore => {
  if (!globalThis.__triketrackViolationStore) {
    globalThis.__triketrackViolationStore = {
      keys: new Set<string>(),
      items: []
    }
  }
  return globalThis.__triketrackViolationStore
}

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

const createDedupKey = (violation: ViolationBatchItem) => {
  const lngBucket = Math.round(violation.lng * 10000)
  const latBucket = Math.round(violation.lat * 10000)
  const timeBucket = Math.floor(violation.ts / 10000)
  return [
    violation.driverId,
    violation.reason,
    violation.routeId,
    `${lngBucket}:${latBucket}`,
    timeBucket
  ].join("|")
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

  const store = getViolationStore()
  const results: ViolationBatchResult[] = []

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

    const dedupKey = createDedupKey(candidate)
    if (store.keys.has(dedupKey)) {
      results.push({ id: candidate.id, status: "duplicate" })
      continue
    }

    store.keys.add(dedupKey)
    store.items.push({ ...candidate, storedAt: Date.now() })
    results.push({ id: candidate.id, status: "stored" })
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
