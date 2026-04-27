import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import { getDashboardDataForAdmin } from "../../../../lib/dashboard-data-db"

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

  try {
    const data = await getDashboardDataForAdmin(session.profile)
    return jsonNoStore({
      ok: true,
      data
    })
  } catch (error) {
    return jsonNoStore(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load dashboard data."
      },
      { status: 400 }
    )
  }
}
