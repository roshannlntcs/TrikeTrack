export type EmergencyAlertStatus =
  | "created"
  | "pending_admin"
  | "acknowledged"
  | "responding"
  | "resolved"

export type EmergencyAlertRecord = {
  emergencyId: number
  passengerTrackingKey: string
  qrId: number
  qrToken: string
  driverId: number
  driverCode: string
  driverName: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeId?: number
  routeName?: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  source: string
  alertType: string
  status: EmergencyAlertStatus
  latitude?: number
  longitude?: number
  locationLabel?: string
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  acknowledgedByAdminId?: number
  acknowledgedByAdminEmail?: string
}

type EmergencyResponse = {
  ok?: boolean
  message?: string
  data?: EmergencyAlertRecord
}

type EmergencyRealtimeEvent = {
  type?: "upsert"
  alert?: EmergencyAlertRecord
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

const buildEmergencyBaseUrl = (apiBaseUrl: string) =>
  apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}/api/public/emergency` : "/api/public/emergency"

export const createPassengerEmergency = async (
  apiBaseUrl: string,
  qrToken: string,
  location: {
    latitude: number
    longitude: number
    accuracy?: number
  }
) => {
  const response = await fetch(buildEmergencyBaseUrl(apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      qrToken,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      deviceInfo: {
        submittedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        language: navigator.language
      }
    })
  })

  const payload = (await response.json().catch(() => ({}))) as EmergencyResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Emergency API returned HTTP ${response.status}.`)
  }

  return payload.data
}

export const getPassengerEmergency = async (apiBaseUrl: string, trackingKey: string) => {
  const response = await fetch(
    `${buildEmergencyBaseUrl(apiBaseUrl)}?trackingKey=${encodeURIComponent(trackingKey)}`,
    {
      cache: "no-store"
    }
  )

  const payload = (await response.json().catch(() => ({}))) as EmergencyResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Emergency API returned HTTP ${response.status}.`)
  }

  return payload.data
}

export const connectPassengerEmergencyStream = (
  apiBaseUrl: string,
  trackingKey: string,
  handlers: {
    onSnapshot?: (alert: EmergencyAlertRecord) => void
    onEmergency?: (alert: EmergencyAlertRecord) => void
    onError?: (error: unknown) => void
  }
) => {
  let disposed = false
  let activeController: AbortController | null = null

  const run = async () => {
    let reconnectDelayMs = 1500

    while (!disposed) {
      const controller = new AbortController()
      activeController = controller

      try {
        const response = await fetch(
          `${buildEmergencyBaseUrl(apiBaseUrl)}/stream?trackingKey=${encodeURIComponent(trackingKey)}`,
          {
            signal: controller.signal,
            cache: "no-store"
          }
        )

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
              const parsed = JSON.parse(payload) as EmergencyRealtimeEvent
              if (!parsed.alert) return

              if (eventName === "snapshot") {
                handlers.onSnapshot?.(parsed.alert)
                return
              }

              if (eventName === "emergency") {
                handlers.onEmergency?.(parsed.alert)
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
