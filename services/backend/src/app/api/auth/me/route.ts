import { NextResponse } from "next/server"
import { getAdminProfileByAuthUserId } from "../../../../lib/admin-auth-db"
import { getSupabaseUserFromAccessToken } from "../../../../lib/supabase-auth"

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? ""
  if (!authorization.startsWith("Bearer ")) return null
  return authorization.slice("Bearer ".length).trim()
}

export async function GET(request: Request) {
  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return NextResponse.json(
      {
        ok: false,
        message: "Missing bearer token."
      },
      { status: 401 }
    )
  }

  const user = await getSupabaseUserFromAccessToken(accessToken)
  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid or expired session."
      },
      { status: 401 }
    )
  }

  const profile = await getAdminProfileByAuthUserId(user.id)
  if (!profile) {
    return NextResponse.json(
      {
        ok: false,
        message: "This user is not linked to an active admin account."
      },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    profile
  })
}
