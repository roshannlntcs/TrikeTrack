import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import { decideDriverPasswordResetRequest } from "../../../../lib/driver-password-reset-db"

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

export async function PATCH(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

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
  const requestId = Number(payload.requestId)
  const decision = payload.decision

  if (!Number.isInteger(requestId) || requestId <= 0) {
    return invalid("requestId must be a positive number.")
  }
  if (decision !== "approve" && decision !== "deny") {
    return invalid("decision must be approve or deny.")
  }

  try {
    const result = await decideDriverPasswordResetRequest(
      session.profile,
      requestId,
      decision
    )

    return NextResponse.json({
      ok: true,
      data: result
    })
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Unable to update password reset request.",
      400
    )
  }
}
