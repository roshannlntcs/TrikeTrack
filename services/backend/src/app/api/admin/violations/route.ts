import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import {
  updateViolationStatusForAdmin,
  type AdminViolationAlertSource,
  type AdminViolationStatusUpdate
} from "../../../../lib/violations-db"

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const ALLOWED_STATUSES = new Set<AdminViolationStatusUpdate>([
  "open",
  "under_review",
  "resolved"
])

const ALLOWED_SOURCES = new Set<AdminViolationAlertSource>([
  "system_violation",
  "driver_violation"
])

const stripViolationPrefix = (source: AdminViolationAlertSource, value: string) => {
  const trimmed = value.trim()
  if (source === "system_violation") {
    return trimmed.replace(/^system-/, "")
  }
  return trimmed.replace(/^driver-/, "")
}

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
  const source = payload.alertSource
  const status = payload.status
  const rawViolationId = payload.violationId

  if (typeof source !== "string" || !ALLOWED_SOURCES.has(source as AdminViolationAlertSource)) {
    return invalid("alertSource must be system_violation or driver_violation.")
  }
  if (typeof status !== "string" || !ALLOWED_STATUSES.has(status as AdminViolationStatusUpdate)) {
    return invalid("status must be open, under_review, or resolved.")
  }
  if (typeof rawViolationId !== "string" || rawViolationId.trim().length === 0) {
    return invalid("violationId is required.")
  }

  const alertSource = source as AdminViolationAlertSource
  const violationId = stripViolationPrefix(alertSource, rawViolationId)
  if (alertSource === "system_violation" && !Number.isInteger(Number(violationId))) {
    return invalid("violationId must identify a system violation.")
  }

  try {
    await updateViolationStatusForAdmin(
      session.profile,
      alertSource,
      violationId,
      status as AdminViolationStatusUpdate
    )

    return NextResponse.json({
      ok: true,
      data: {
        alertSource,
        violationId: rawViolationId,
        status
      }
    })
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Unable to update violation alert.",
      400
    )
  }
}
