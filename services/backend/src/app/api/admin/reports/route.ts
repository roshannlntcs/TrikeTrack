import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import { listAppealsForAdmin } from "../../../../lib/appeals-db"
import {
  isReportStatus,
  listReportTypes,
  listReportsForAdmin,
  updateReportStatusForAdmin
} from "../../../../lib/reports-db"

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

export async function GET(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  try {
    const [reports, reportTypes, appeals] = await Promise.all([
      listReportsForAdmin(session.profile),
      listReportTypes(),
      listAppealsForAdmin(session.profile)
    ])

    return NextResponse.json({
      ok: true,
      data: {
        reports,
        reportTypes,
        appeals
      }
    })
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Unable to load reports.",
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
  const reportId = Number(payload.reportId)
  const status = payload.status

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return invalid("reportId must be a positive integer.")
  }

  if (!isReportStatus(status)) {
    return invalid("status must be a valid report status.")
  }

  try {
    const report = await updateReportStatusForAdmin(session.profile, reportId, status)
    return NextResponse.json({
      ok: true,
      data: report
    })
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : "Unable to update report status.",
      400
    )
  }
}
