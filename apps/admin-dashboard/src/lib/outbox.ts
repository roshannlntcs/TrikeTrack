import {
  getOutboxItems,
  removeOutboxItems,
  bumpOutboxAttempts,
  type OutboxItem
} from "./db"
import type { ViolationEvent } from "../../../../common/types"

export type OutboxSyncResult = {
  sent: number
  pending: number
  failed: number
  lastError?: string
}

type ViolationBatchResult = {
  id: string
  status: "stored" | "duplicate" | "rejected"
  reason?: string
}

type SyncResponse = {
  results?: ViolationBatchResult[]
}

type ViolationBatchItem = ViolationEvent & {
  id: string
}

export async function syncOutbox(
  endpoint: string,
  limit = 100
): Promise<OutboxSyncResult> {
  const items = await getOutboxItems(limit)
  if (items.length === 0) {
    return { sent: 0, pending: 0, failed: 0 }
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        violations: items.map((item) => ({
          id: item.id,
          type: "violation",
          driverId: item.payload.driverId,
          ts: item.payload.ts,
          lng: item.payload.lng,
          lat: item.payload.lat,
          reason: item.payload.reason ?? "OUTSIDE_ROUTE_CORRIDOR",
          routeId: item.payload.routeId ?? "umasa-brgy-18b-geofence",
          speed: item.payload.speed,
          heading: item.payload.heading,
          accuracy: item.payload.accuracy
        })) as ViolationBatchItem[]
      })
    })

    if (!response.ok) {
      await bumpOutboxAttempts(items.map((item) => item.id))
      return {
        sent: 0,
        pending: items.length,
        failed: items.length,
        lastError: `HTTP ${response.status}`
      }
    }

    const payload = (await response.json()) as SyncResponse
    const results = Array.isArray(payload.results) ? payload.results : []
    const resultById = new Map(results.map((result) => [result.id, result]))

    const accepted: string[] = []
    const rejected: string[] = []

    for (const item of items) {
      const result = resultById.get(item.id)
      if (!result) {
        accepted.push(item.id)
        continue
      }
      if (result.status === "stored" || result.status === "duplicate") {
        accepted.push(item.id)
      } else {
        rejected.push(item.id)
      }
    }

    await removeOutboxItems(accepted)
    await bumpOutboxAttempts(rejected)

    return {
      sent: accepted.length,
      pending: Math.max(0, items.length - accepted.length),
      failed: rejected.length
    }
  } catch (error) {
    await bumpOutboxAttempts(items.map((item) => item.id))
    return {
      sent: 0,
      pending: items.length,
      failed: items.length,
      lastError: String(error)
    }
  }
}

export const groupOutboxByType = (items: OutboxItem[]) =>
  items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1
    return acc
  }, {})
