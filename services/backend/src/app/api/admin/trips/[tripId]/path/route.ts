import { NextResponse } from "next/server"
import { requireAdminSession } from "../../../../../../lib/admin-session"
import { query } from "../../../../../../lib/database"
import { getTripPathByTripId } from "../../../../../../lib/trip-paths-db"

type TripPathRouteContext = {
  params: {
    tripId: string
  }
}

type TripScopeRow = {
  trip_id: number
}

const canReadTripPath = async (
  tripId: number,
  profile: {
    role: "superadmin" | "barangay_admin" | "toda_admin"
    barangayId?: number
    todaId?: number
  }
) => {
  const clauses = ["tp.trip_id = $1"]
  const params: unknown[] = [tripId]

  if (profile.role === "barangay_admin") {
    if (!profile.barangayId) return false
    params.push(profile.barangayId)
    clauses.push(`b.barangay_id = $${params.length}`)
  }

  if (profile.role === "toda_admin") {
    if (!profile.todaId) return false
    params.push(profile.todaId)
    clauses.push(`td.toda_id = $${params.length}`)
  }

  const result = await query<TripScopeRow>(
    `
      SELECT tp.trip_id
      FROM public.trips tp
      JOIN public.routes r
        ON r.route_id = tp.route_id
      JOIN public.todas td
        ON td.toda_id = r.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      WHERE ${clauses.join(" AND ")}
      LIMIT 1
    `,
    params
  )

  return Boolean(result.rows[0]?.trip_id)
}

export async function GET(request: Request, context: TripPathRouteContext) {
  const tripId = Number(context.params.tripId)
  if (!Number.isInteger(tripId) || tripId <= 0) {
    return NextResponse.json(
      { ok: false, message: "tripId must be a positive integer." },
      { status: 400 }
    )
  }

  const session = await requireAdminSession(request)
  if (session.response) return session.response

  const allowed = await canReadTripPath(tripId, session.profile)
  if (!allowed) {
    return NextResponse.json(
      { ok: false, message: "Trip not found for this admin scope." },
      { status: 404 }
    )
  }

  try {
    const data = await getTripPathByTripId(tripId)
    return NextResponse.json({
      ok: true,
      data
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to load trip path."
      },
      { status: 500 }
    )
  }
}
