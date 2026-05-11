import { NextResponse } from "next/server"
import {
  createPassengerReport,
  createSuspiciousQrReport,
  getPassengerReportContextByQrToken,
  listReportTypes
} from "../../../../lib/reports-db"

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
])
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024

const LOCAL_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i

const parseOrigin = (value: string | null | undefined) => {
  if (!isNonEmptyString(value)) {
    return null
  }

  try {
    return new URL(value.trim().replace(/\r|\n/g, "")).origin
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

  return requestOrigin
}

const applyCorsHeaders = (response: NextResponse, request: Request) => {
  const allowedOrigin = resolveCorsOrigin(request)

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

const invalid = (request: Request, message: string, status = 400) =>
  jsonResponse(request, { ok: false, message }, status)

export async function OPTIONS(request: Request) {
  return applyCorsHeaders(new NextResponse(null, { status: 204 }), request)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const qrToken = url.searchParams.get("qrToken")

  if (!isNonEmptyString(qrToken)) {
    return invalid(request, "qrToken is required.")
  }

  try {
    const [context, reportTypes] = await Promise.all([
      getPassengerReportContextByQrToken(qrToken.trim()),
      listReportTypes()
    ])

    if (!context) {
      return invalid(request, "This QR code is invalid, inactive, or expired.", 404)
    }

    return jsonResponse(request, {
      ok: true,
      data: {
        context,
        reportTypes
      }
    })
  } catch (error) {
    return invalid(
      request,
      error instanceof Error ? error.message : "Unable to load passenger reporting data.",
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
  if (!isNonEmptyString(payload.reportTypeCode)) {
    return invalid(request, "reportTypeCode is required.")
  }
  if (!isNonEmptyString(payload.description)) {
    return invalid(request, "description is required.")
  }

  const passengerName =
    typeof payload.passengerName === "string" && payload.passengerName.trim().length > 0
      ? payload.passengerName.trim()
      : undefined
  const passengerContact =
    typeof payload.passengerContact === "string" && payload.passengerContact.trim().length > 0
      ? payload.passengerContact.trim()
      : undefined
  const rawEvidenceImage =
    payload.evidenceImage && typeof payload.evidenceImage === "object" && !Array.isArray(payload.evidenceImage)
      ? (payload.evidenceImage as Record<string, unknown>)
      : null

  let evidenceImage:
    | {
        dataUrl: string
        mimeType: string
        fileName?: string
      }
    | undefined

  if (rawEvidenceImage) {
    if (!isNonEmptyString(rawEvidenceImage.dataUrl) || !isNonEmptyString(rawEvidenceImage.mimeType)) {
      return invalid(request, "evidenceImage must include a valid file payload.")
    }

    const mimeType = rawEvidenceImage.mimeType.trim().toLowerCase()
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(mimeType)) {
      return invalid(request, "Only JPG, PNG, WEBP, or PDF evidence files are supported.")
    }

    const dataUrl = rawEvidenceImage.dataUrl.trim()
    const prefix = `data:${mimeType};base64,`
    if (!dataUrl.startsWith(prefix)) {
      return invalid(request, "Evidence file payload is invalid.")
    }

    const base64Payload = dataUrl.slice(prefix.length)
    const estimatedBytes = Math.floor((base64Payload.length * 3) / 4)
    if (!base64Payload || estimatedBytes <= 0 || estimatedBytes > MAX_EVIDENCE_BYTES) {
      return invalid(request, "Evidence file must be 5MB or smaller.")
    }

    evidenceImage = {
      dataUrl,
      mimeType,
      fileName:
        typeof rawEvidenceImage.fileName === "string" && rawEvidenceImage.fileName.trim().length > 0
          ? rawEvidenceImage.fileName.trim()
          : undefined
    }
  }

  const deviceInfo =
    payload.deviceInfo && typeof payload.deviceInfo === "object" && !Array.isArray(payload.deviceInfo)
      ? {
          ...(payload.deviceInfo as Record<string, unknown>),
          source: "qr_web_form"
        }
      : {
          source: "qr_web_form",
          userAgent: request.headers.get("user-agent") ?? undefined,
          acceptLanguage: request.headers.get("accept-language") ?? undefined
        }

  try {
    const report = await createPassengerReport({
      qrToken: payload.qrToken.trim(),
      reportTypeCode: payload.reportTypeCode.trim(),
      description: payload.description.trim(),
      passengerName,
      passengerContact,
      deviceInfo,
      evidenceImage
    })

    return jsonResponse(request, {
      ok: true,
      data: report
    })
  } catch (error) {
    if (payload.reportTypeCode.trim() === "suspicious_qr") {
      try {
        const report = await createSuspiciousQrReport({
          qrToken: payload.qrToken.trim(),
          reportTypeCode: payload.reportTypeCode.trim(),
          description: payload.description.trim(),
          passengerName,
          passengerContact,
          deviceInfo
        })

        return jsonResponse(request, {
          ok: true,
          data: report
        })
      } catch (suspiciousError) {
        return invalid(
          request,
          suspiciousError instanceof Error
            ? suspiciousError.message
            : "Unable to submit suspicious QR report.",
          400
        )
      }
    }

    return invalid(
      request,
      error instanceof Error ? error.message : "Unable to submit report.",
      400
    )
  }
}
