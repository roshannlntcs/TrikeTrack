import { NextResponse } from "next/server"
import { createPassengerReport } from "../../../../lib/reports-db"

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return invalid("Request body must be valid JSON.")
  }

  if (!body || typeof body !== "object") {
    return invalid("Expected a JSON object.")
  }

  const payload = body as Record<string, unknown>
  if (!isNonEmptyString(payload.qrToken)) {
    return invalid("qrToken is required.")
  }
  if (!isNonEmptyString(payload.reportTypeCode)) {
    return invalid("reportTypeCode is required.")
  }
  if (!isNonEmptyString(payload.description)) {
    return invalid("description is required.")
  }

  const deviceInfo =
    payload.deviceInfo && typeof payload.deviceInfo === "object" && !Array.isArray(payload.deviceInfo)
      ? (payload.deviceInfo as Record<string, unknown>)
      : {
          userAgent: request.headers.get("user-agent") ?? undefined,
          acceptLanguage: request.headers.get("accept-language") ?? undefined
        }

  try {
    const report = await createPassengerReport({
      qrToken: payload.qrToken.trim(),
      reportTypeCode: payload.reportTypeCode.trim(),
      description: payload.description.trim(),
      deviceInfo
    })

    return NextResponse.json({
      ok: true,
      data: report
    })
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Unable to submit report.",
      400
    )
  }
}
