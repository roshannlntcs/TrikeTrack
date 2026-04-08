import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import {
  listEmergencyAlertsForAdmin,
  updateEmergencyAlertStatusForAdmin,
  type EmergencyAlertStatus
} from "../../../../lib/emergency-alerts-db"

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const ALLOWED_ADMIN_STATUSES = new Set<EmergencyAlertStatus>([
  "acknowledged",
  "responding",
  "resolved"
])

export async function GET(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  try {
    const emergencies = await listEmergencyAlertsForAdmin(session.profile, {
      limit: 50
    })

    return NextResponse.json({
      ok: true,
      data: emergencies
    })
  } catch (error) {
    console.error("Failed to load emergency alerts:", error)
    return invalid(
      error instanceof Error ? error.message : "Unable to load emergency alerts.",
      400
    )
  }
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
  const emergencyId = Number(payload.emergencyId)
  const status = payload.status

  if (!Number.isInteger(emergencyId) || emergencyId <= 0) {
    return invalid("emergencyId must be a positive integer.")
  }

  if (typeof status !== "string" || !ALLOWED_ADMIN_STATUSES.has(status as EmergencyAlertStatus)) {
    return invalid("status must be one of acknowledged, responding, or resolved.")
  }

  try {
    const emergency = await updateEmergencyAlertStatusForAdmin(
      session.profile,
      emergencyId,
      status as Extract<EmergencyAlertStatus, "acknowledged" | "responding" | "resolved">
    )

    return NextResponse.json({
      ok: true,
      data: emergency
    })
  } catch (error) {
    console.error("Failed to update emergency alert:", {
      emergencyId,
      status,
      adminId: session.profile.adminId,
      role: session.profile.role,
      todaId: session.profile.todaId,
      barangayId: session.profile.barangayId,
      error
    })
    return invalid(
      error instanceof Error ? error.message : "Unable to update emergency alert.",
      400
    )
  }
}
