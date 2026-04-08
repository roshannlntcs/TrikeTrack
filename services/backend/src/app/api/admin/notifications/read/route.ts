import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../../lib/admin-session"
import { markDashboardNotificationsRead } from "../../../../../lib/dashboard-data-db"

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "string" && item.trim().length > 0)

export async function POST(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Request body must be valid JSON."
      },
      { status: 400 }
    )
  }

  const notificationKeys = (body as Record<string, unknown>)?.notificationKeys
  if (!isStringArray(notificationKeys)) {
    return NextResponse.json(
      {
        ok: false,
        message: "Expected { notificationKeys: string[] }."
      },
      { status: 400 }
    )
  }

  try {
    await markDashboardNotificationsRead(session.profile.adminId, notificationKeys)
    return NextResponse.json({
      ok: true,
      updated: [...new Set(notificationKeys)].length
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to mark notifications as read."
      },
      { status: 400 }
    )
  }
}
