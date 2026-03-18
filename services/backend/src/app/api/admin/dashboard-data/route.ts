import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../lib/admin-session"
import { getDashboardDataForAdmin } from "../../../../lib/dashboard-data-db"

export async function GET(request: Request) {
  const session = await requireAdminSession(request)
  if (session.response) return session.response

  try {
    const data = await getDashboardDataForAdmin(session.profile)
    return NextResponse.json({
      ok: true,
      data
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load dashboard data."
      },
      { status: 400 }
    )
  }
}
