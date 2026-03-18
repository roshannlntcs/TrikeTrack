import { NextResponse } from "next/server"
import { getAdminProfileByAuthUserId } from "../../../../lib/admin-auth-db"
import { getSupabaseUserFromAccessToken } from "../../../../lib/supabase-auth"
import { getRecentTripPoints } from "../../../../lib/trip-points-db"

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

  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Number(limitParam) : undefined
  const invalidLimit =
    limitParam !== null &&
    (limit === undefined || !Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0)

  if (invalidLimit) {
    return NextResponse.json(
      {
        ok: false,
        message: "limit must be a positive integer."
      },
      { status: 400 }
    )
  }

  try {
    const points = await getRecentTripPoints({
      limit,
      driverId: url.searchParams.get("driverId") ?? undefined,
      tripId: url.searchParams.get("tripId") ?? undefined
    })

    return NextResponse.json({
      ok: true,
      points
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to load recent trip points."
      },
      { status: 400 }
    )
  }
}
