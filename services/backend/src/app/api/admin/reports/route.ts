import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import { listAppealsForAdmin, markAppealViewedForAdmin } from "../../../../lib/appeals-db"
import {
  isReportStatus,
  listReportTypes,
  listReportsForAdmin,
  markReportViewedForAdmin,
  getUnreadReportCount,
  getReportCount,
  updateReportStatusForAdmin
} from "../../../../lib/reports-db"

const invalid = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status })

const jsonNoStore = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers ?? {})
    }
  })

export async function GET(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  const url = new URL(request.url)
  const getUnreadCount = url.searchParams.get("getUnreadCount") === "true"
  const getCount = url.searchParams.get("getCount") === "true"

  try {
    if (getUnreadCount) {
      const unreadCount = await getUnreadReportCount(session.profile)
      return jsonNoStore({
        ok: true,
        data: {
          unreadCount
        }
      })
    }

    if (getCount) {
      const reportCount = await getReportCount(session.profile)
      return jsonNoStore({
        ok: true,
        data: {
          reportCount
        }
      })
    }

    const [reports, reportTypes, appeals] = await Promise.all([
      listReportsForAdmin(session.profile),
      listReportTypes(),
      listAppealsForAdmin(session.profile)
    ])

    return jsonNoStore({
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
  
  if (payload.action === "markReportViewed") {
    const reportId = typeof payload.reportId === "number" ? payload.reportId : undefined

    if (!reportId || reportId <= 0) {
      return invalid("reportId must be a positive integer.")
    }

    try {
      const reportViewState = await markReportViewedForAdmin(session.profile, reportId)
      return NextResponse.json({
        ok: true,
        data: reportViewState
      })
    } catch (error) {
      return invalid(
        error instanceof Error ? error.message : "Unable to mark report as viewed.",
        400
      )
    }
  }

  if (payload.action === "markAppealViewed") {
    const appealId = typeof payload.appealId === "string" ? payload.appealId.trim() : ""

    if (!appealId) {
      return invalid("appealId must be a non-empty string.")
    }

    try {
      const appealViewState = await markAppealViewedForAdmin(session.profile, appealId)
      return NextResponse.json({
        ok: true,
        data: appealViewState
      })
    } catch (error) {
      return invalid(
        error instanceof Error ? error.message : "Unable to mark appeal as viewed.",
        400
      )
    }
  }

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
