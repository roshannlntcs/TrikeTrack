export type PassengerTripStatus = "scheduled" | "ongoing" | "completed" | "cancelled"

export type PassengerTripView = {
  available: boolean
  driverId: number
  driverCode: string
  driverName: string
  qrId: number
  trip?: {
    tripId: number
    tripStatus: PassengerTripStatus
    routeId?: number
    routeName?: string
    startedAt: string
    endedAt?: string
    fareAmount?: number
    timerSeconds: number
    distanceKilometers: number
    speedKph?: number
    plateOrBodyNumber: string
    trackingStatus: "live" | "ended" | "last_known" | "waiting"
    lastUpdatedAt?: string
    location?: {
      latitude: number
      longitude: number
      heading?: number
      accuracy?: number
      recordedAt: string
      updatedAt?: string
      isOnline: boolean
    }
    breadcrumbs: Array<{
      latitude: number
      longitude: number
    }>
    finalRoute: {
      status: "ready" | "processing"
      coordinates: Array<[number, number]>
    }
  }
}

type TripViewResponse = {
  ok?: boolean
  message?: string
  data?: PassengerTripView
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

const buildTripViewBaseUrl = (apiBaseUrl: string) =>
  apiBaseUrl ? `${apiBaseUrl.replace(/\/+$/, "")}/api/public/trip-view` : "/api/public/trip-view"

const buildTripViewUrl = (apiBaseUrl: string, qrToken: string, tripId?: number) => {
  const url = new URL(buildTripViewBaseUrl(apiBaseUrl), window.location.origin)
  url.searchParams.set("qrToken", qrToken)
  if (tripId) {
    url.searchParams.set("tripId", String(tripId))
  }

  if (apiBaseUrl) {
    return `${url.pathname}${url.search}`.startsWith("/api/")
      ? `${apiBaseUrl.replace(/\/+$/, "")}${url.pathname}${url.search}`
      : url.toString()
  }

  return `${url.pathname}${url.search}`
}

export const getPassengerTripView = async (
  apiBaseUrl: string,
  qrToken: string,
  tripId?: number
) => {
  const response = await fetch(buildTripViewUrl(apiBaseUrl, qrToken, tripId), {
    cache: "no-store"
  })

  const payload = (await response.json().catch(() => ({}))) as TripViewResponse
  if (!response.ok || !payload.data) {
    throw new Error(payload.message ?? `Trip view API returned HTTP ${response.status}.`)
  }

  return payload.data
}

export const connectPassengerTripStream = (
  apiBaseUrl: string,
  qrToken: string,
  tripId: number | undefined,
  handlers: {
    onSnapshot?: (view: PassengerTripView) => void
    onTrip?: (view: PassengerTripView) => void
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
        const base = buildTripViewBaseUrl(apiBaseUrl)
        const streamUrl = `${base}/stream?qrToken=${encodeURIComponent(qrToken)}${
          tripId ? `&tripId=${encodeURIComponent(String(tripId))}` : ""
        }`

        const response = await fetch(streamUrl, {
          signal: controller.signal,
          cache: "no-store"
        })

        if (!response.ok || !response.body) {
          throw new Error(`Trip stream returned HTTP ${response.status}.`)
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
              const parsed = JSON.parse(payload) as PassengerTripView

              if (eventName === "snapshot") {
                handlers.onSnapshot?.(parsed)
                return
              }

              if (eventName === "trip") {
                handlers.onTrip?.(parsed)
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
