import {
  getEmergencyAlertsChannelName,
  getPassengerEmergencyAlertByTrackingKey
} from "../../../../../lib/emergency-alerts-db"
import { getPool } from "../../../../../lib/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const encoder = new TextEncoder()

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
  const trackingKey = url.searchParams.get("trackingKey")

  if (!isNonEmptyString(trackingKey)) {
    return new Response(JSON.stringify({ ok: false, message: "trackingKey is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    })
  }

  const emergency = await getPassengerEmergencyAlertByTrackingKey(trackingKey.trim())
  if (!emergency) {
    return new Response(JSON.stringify({ ok: false, message: "Emergency alert not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    })
  }

  const client = await getPool().connect()
  await client.query(`LISTEN ${getEmergencyAlertsChannelName()}`)

  let keepAliveTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = async () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer)
          keepAliveTimer = null
        }

        client.removeListener("notification", onNotification)
        request.signal.removeEventListener("abort", onAbort)
        await client.query(`UNLISTEN ${getEmergencyAlertsChannelName()}`).catch(() => null)
        client.release()
      }

      const onAbort = () => {
        void cleanup().finally(() => {
          controller.close()
        })
      }

      const onNotification = (message: { payload?: string }) => {
        if (!message.payload) return

        try {
          const parsed = JSON.parse(message.payload) as {
            type?: string
            alert?: { passengerTrackingKey?: string }
          }
          if (parsed.type !== "upsert") return
          if (parsed.alert?.passengerTrackingKey !== trackingKey.trim()) return

          controller.enqueue(writeEvent("emergency", parsed))
        } catch {
          controller.enqueue(writeComment("invalid-payload"))
        }
      }

      request.signal.addEventListener("abort", onAbort)
      client.on("notification", onNotification)

      controller.enqueue(writeEvent("snapshot", { type: "upsert", alert: emergency }))
      keepAliveTimer = setInterval(() => {
        controller.enqueue(writeComment("keepalive"))
      }, 25000)
    },
    cancel() {
      client.removeAllListeners("notification")
      client.query(`UNLISTEN ${getEmergencyAlertsChannelName()}`).catch(() => null)
      client.release()
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
