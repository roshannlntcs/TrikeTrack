import { getPassengerTripViewByQrToken } from "../../../../../lib/passenger-trip-view-db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const encoder = new TextEncoder()
const POLL_INTERVAL_MS = 5000

const writeEvent = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

const writeComment = (value: string) => encoder.encode(`: ${value}\n\n`)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i

const parseOrigin = (value: string | null | undefined) => {
  if (!isNonEmptyString(value)) {
    return null
  }

  try {
    return new URL(value.trim()).origin
  } catch {
    return null
  }
}

const getConfiguredPassengerOrigin = () => {
  const candidates = [
    process.env.PUBLIC_PASSENGER_REPORT_BASE_URL,
    process.env.PASSENGER_APP_BASE_URL,
    process.env.PUBLIC_PASSENGER_REPORT_URL
  ]

  for (const candidate of candidates) {
    const origin = parseOrigin(candidate)
    if (origin) {
      return origin
    }
  }

  return null
}

const resolveCorsOrigin = (request: Request) => {
  const requestOrigin = parseOrigin(request.headers.get("origin"))
  if (!requestOrigin) {
    return null
  }

  const configuredOrigin = getConfiguredPassengerOrigin()
  if (configuredOrigin) {
    return requestOrigin === configuredOrigin ? requestOrigin : null
  }

  if (process.env.NODE_ENV !== "production" && LOCAL_ORIGIN_PATTERN.test(requestOrigin)) {
    return requestOrigin
  }

  return null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const qrToken = url.searchParams.get("qrToken")
  const tripIdParam = url.searchParams.get("tripId")

  if (!isNonEmptyString(qrToken)) {
    return new Response(JSON.stringify({ ok: false, message: "qrToken is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  const preferredTripId =
    tripIdParam && tripIdParam.trim().length > 0 ? Number(tripIdParam.trim()) : undefined
  if (tripIdParam && (!Number.isInteger(preferredTripId) || (preferredTripId ?? 0) <= 0)) {
    return new Response(JSON.stringify({ ok: false, message: "tripId must be a positive integer." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  const initialSnapshot = await getPassengerTripViewByQrToken(qrToken.trim(), preferredTripId)
  if (!initialSnapshot) {
    return new Response(JSON.stringify({ ok: false, message: "This QR code is invalid, inactive, or expired." }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    })
  }

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      let lastSerialized = JSON.stringify(initialSnapshot)

      const cleanup = () => {
        if (closed) return
        closed = true

        if (keepAliveTimer) {
          clearInterval(keepAliveTimer)
          keepAliveTimer = null
        }
        if (pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        request.signal.removeEventListener("abort", onAbort)
      }

      const closeController = () => {
        cleanup()
        controller.close()
      }

      const onAbort = () => {
        closeController()
      }

      const poll = async () => {
        try {
          const nextSnapshot = await getPassengerTripViewByQrToken(
            qrToken.trim(),
            preferredTripId ?? initialSnapshot.trip?.tripId
          )
          if (!nextSnapshot || closed) {
            return
          }

          const serialized = JSON.stringify(nextSnapshot)
          if (serialized === lastSerialized) {
            return
          }

          lastSerialized = serialized
          controller.enqueue(writeEvent("trip", nextSnapshot))
        } catch {
          if (!closed) {
            controller.enqueue(writeComment("poll-error"))
          }
        }
      }

      request.signal.addEventListener("abort", onAbort)

      controller.enqueue(writeEvent("snapshot", initialSnapshot))
      keepAliveTimer = setInterval(() => {
        if (!closed) {
          controller.enqueue(writeComment("keepalive"))
        }
      }, 25000)
      pollTimer = setInterval(() => {
        void poll()
      }, POLL_INTERVAL_MS)
    },
    cancel() {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
      }
      if (pollTimer) {
        clearInterval(pollTimer)
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      Vary: "Origin",
      ...(resolveCorsOrigin(request)
        ? {
            "Access-Control-Allow-Origin": resolveCorsOrigin(request)!
          }
        : {})
    }
  })
}
