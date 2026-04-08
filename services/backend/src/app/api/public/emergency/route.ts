import { NextResponse } from "next/server"
import {
  createPassengerEmergencyAlert,
  getPassengerEmergencyAlertByTrackingKey
} from "../../../../lib/emergency-alerts-db"

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

const applyCorsHeaders = (response: NextResponse, request: Request) => {
  const allowedOrigin = resolveCorsOrigin(request)

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  response.headers.set("Vary", "Origin")

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin)
  }

  return response
}

const jsonResponse = (request: Request, body: unknown, status = 200) =>
  applyCorsHeaders(NextResponse.json(body, { status }), request)

const invalid = (request: Request, message: string, status = 400) =>
  jsonResponse(request, { ok: false, message }, status)

export async function OPTIONS(request: Request) {
  return applyCorsHeaders(new NextResponse(null, { status: 204 }), request)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const trackingKey = url.searchParams.get("trackingKey")

  if (!isNonEmptyString(trackingKey)) {
    return invalid(request, "trackingKey is required.")
  }

  try {
    const emergency = await getPassengerEmergencyAlertByTrackingKey(trackingKey.trim())
    if (!emergency) {
      return invalid(request, "Emergency alert not found.", 404)
    }

    return jsonResponse(request, {
      ok: true,
      data: emergency
    })
  } catch (error) {
    return invalid(
      request,
      error instanceof Error ? error.message : "Unable to load emergency alert.",
      400
    )
  }
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return invalid(request, "Request body must be valid JSON.")
  }

  if (!body || typeof body !== "object") {
    return invalid(request, "Expected a JSON object.")
  }

  const payload = body as Record<string, unknown>
  if (!isNonEmptyString(payload.qrToken)) {
    return invalid(request, "qrToken is required.")
  }

  const deviceInfo =
    payload.deviceInfo && typeof payload.deviceInfo === "object" && !Array.isArray(payload.deviceInfo)
      ? {
          ...(payload.deviceInfo as Record<string, unknown>),
          source: "qr_emergency_button",
          userAgent: request.headers.get("user-agent") ?? undefined,
          acceptLanguage: request.headers.get("accept-language") ?? undefined
        }
      : {
          source: "qr_emergency_button",
          userAgent: request.headers.get("user-agent") ?? undefined,
          acceptLanguage: request.headers.get("accept-language") ?? undefined
        }

  try {
    const emergency = await createPassengerEmergencyAlert({
      qrToken: payload.qrToken.trim(),
      deviceInfo
    })

    return jsonResponse(request, {
      ok: true,
      data: emergency
    })
  } catch (error) {
    return invalid(
      request,
      error instanceof Error ? error.message : "Unable to send emergency alert.",
      400
    )
  }
}
