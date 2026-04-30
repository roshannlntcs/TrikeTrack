import { NextResponse } from "next/server"
import { getPassengerTripViewByQrToken } from "../../../../lib/passenger-trip-view-db"

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

  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
  response.headers.set("Vary", "Origin")

  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin)
  }

  return response
}

const jsonResponse = (request: Request, body: unknown, status = 200) =>
  applyCorsHeaders(NextResponse.json(body, { status }), request)

export async function OPTIONS(request: Request) {
  return applyCorsHeaders(new NextResponse(null, { status: 204 }), request)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const qrToken = url.searchParams.get("qrToken")
  const tripIdParam = url.searchParams.get("tripId")

  if (!isNonEmptyString(qrToken)) {
    return jsonResponse(request, { ok: false, message: "qrToken is required." }, 400)
  }

  const tripId =
    tripIdParam && tripIdParam.trim().length > 0 ? Number(tripIdParam.trim()) : undefined
  if (tripIdParam && (!Number.isInteger(tripId) || (tripId ?? 0) <= 0)) {
    return jsonResponse(request, { ok: false, message: "tripId must be a positive integer." }, 400)
  }

  try {
    const tripView = await getPassengerTripViewByQrToken(qrToken.trim(), tripId)
    if (!tripView) {
      return jsonResponse(
        request,
        { ok: false, message: "This QR code is invalid, inactive, or expired." },
        404
      )
    }

    return jsonResponse(request, { ok: true, data: tripView })
  } catch (error) {
    return jsonResponse(
      request,
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load trip view."
      },
      400
    )
  }
}
