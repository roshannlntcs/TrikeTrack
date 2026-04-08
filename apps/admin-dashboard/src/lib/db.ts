import { openDB } from "idb"
import type { ViolationReason } from "./shared-types"

export type LocationPoint = {
  id?: string
  driverId: string
  ts: number
  lng: number
  lat: number
  speed?: number
  heading?: number
  accuracy?: number
  tripId?: string
  violation?: boolean
}

export type ViolationPayload = {
  driverId: string
  ts: number
  lng: number
  lat: number
  routeId: string
  reason: ViolationReason
  speed?: number
  heading?: number
  accuracy?: number
}

export type OutboxItem = {
  id: string
  type: "violation"
  createdAt: number
  attempts: number
  payload: ViolationPayload
}

const createPointId = (point: Pick<LocationPoint, "driverId" | "ts" | "lng" | "lat">) => {
  const lngBucket = Math.round(point.lng * 100000)
  const latBucket = Math.round(point.lat * 100000)
  return `${point.driverId}|${point.ts}|${lngBucket}:${latBucket}`
}

export const dbPromise = openDB("triketrack-admin", 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1 && !db.objectStoreNames.contains("points")) {
      db.createObjectStore("points", { keyPath: "ts" })
    }
    if (oldVersion < 2 && !db.objectStoreNames.contains("outbox")) {
      db.createObjectStore("outbox", { keyPath: "id" })
    }
    if (oldVersion < 3 && db.objectStoreNames.contains("points")) {
      db.deleteObjectStore("points")
      db.createObjectStore("points", { keyPath: "id" })
    }
  }
})

export async function savePoint(p: LocationPoint) {
  const db = await dbPromise
  await db.put("points", {
    ...p,
    id: p.id ?? createPointId(p)
  })
}

export async function getRecentPoints(limit = 200) {
  const db = await dbPromise
  const all = await db.getAll("points")
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit)
}

const createOutboxId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `ob-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function enqueueViolation(payload: ViolationPayload) {
  const db = await dbPromise
  const item: OutboxItem = {
    id: createOutboxId(),
    type: "violation",
    createdAt: Date.now(),
    attempts: 0,
    payload
  }
  await db.put("outbox", item)
  return item
}

export async function getOutboxItems(limit = 200) {
  const db = await dbPromise
  const all = (await db.getAll("outbox")) as OutboxItem[]
  return all.sort((a, b) => a.createdAt - b.createdAt).slice(0, limit)
}

export async function getOutboxCount() {
  const db = await dbPromise
  return db.count("outbox")
}

export async function removeOutboxItems(ids: string[]) {
  if (ids.length === 0) return
  const db = await dbPromise
  const tx = db.transaction("outbox", "readwrite")
  for (const id of ids) {
    await tx.store.delete(id)
  }
  await tx.done
}

export async function bumpOutboxAttempts(ids: string[]) {
  if (ids.length === 0) return
  const db = await dbPromise
  const tx = db.transaction("outbox", "readwrite")
  for (const id of ids) {
    const item = (await tx.store.get(id)) as OutboxItem | undefined
    if (!item) continue
    await tx.store.put({ ...item, attempts: item.attempts + 1 })
  }
  await tx.done
}
