import type { DashboardEmergencyRecord } from "./dashboard-data"

export type AdminEmergencyStatus = "acknowledged" | "responding" | "resolved"

type AdminEmergencyUpdateResponse = {
  ok?: boolean
  message?: string
  data?: DashboardEmergencyRecord
}

type AdminEmergencySnapshotEvent = {
  items?: DashboardEmergencyRecord[]
}

type AdminEmergencyRealtimeEvent = {
  type?: "upsert"
  alert?: DashboardEmergencyRecord
}

type StreamHandlers = {
  onSnapshot?: (items: DashboardEmergencyRecord[]) => void
  onEmergency?: (alert: DashboardEmergencyRecord) => void
  onError?: (error: unknown) => void
}

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const parseSseChunk = (
  chunk: string,
  onEvent: (eventName: string, payload: string) => void
) => {
  const blocks = chunk.split("\n\n")
  const trailing = blocks.pop() ?? ""

  for (const block of blocks) {
    const lines = block.split("\n")
    let eventName = "message"
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim()
        continue
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trim())
      }
    }

    if (dataLines.length > 0) {
      onEvent(eventName, dataLines.join("\n"))
    }
  }

  return trailing
}

export const connectAdminEmergencyStream = (
  accessToken: string,
  handlers: StreamHandlers
) => {
  let disposed = false
  let activeController: AbortController | null = null

  const run = async () => {
    let reconnectDelayMs = 1500
    while (!disposed) {
      const controller = new AbortController()
      activeController = controller

      try {
        const response = await fetch("/api/admin/emergencies/stream", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          signal: controller.signal,
          cache: "no-store"
        })

        if (!response.ok || !response.body) {
          throw new Error(`Emergency stream returned HTTP ${response.status}.`)
        }

        reconnectDelayMs = 1500
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (!disposed) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          buffer = parseSseChunk(buffer, (eventName, payload) => {
            try {
              if (eventName === "snapshot") {
                const parsed = JSON.parse(payload) as AdminEmergencySnapshotEvent
                handlers.onSnapshot?.(parsed.items ?? [])
                return
              }

              if (eventName === "emergency") {
                const parsed = JSON.parse(payload) as AdminEmergencyRealtimeEvent
                if (parsed.alert) {
                  handlers.onEmergency?.(parsed.alert)
                }
              }
            } catch (error) {
              handlers.onError?.(error)
            }
          })
        }
      } catch (error) {
        if (!disposed) {
          handlers.onError?.(error)
          await delay(reconnectDelayMs)
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10000)
        }
      }
    }
  }

  void run()

  return () => {
    disposed = true
    activeController?.abort()
  }
}

export const updateEmergencyAlertStatus = async (
  accessToken: string,
  emergencyId: number,
  status: AdminEmergencyStatus
) => {
  const response = await fetch("/api/admin/emergencies", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      emergencyId,
      status
    })
  })

  const payload = (await response.json().catch(() => ({}))) as AdminEmergencyUpdateResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Emergency API returned HTTP ${response.status}.`)
  }

  return payload.data
}
