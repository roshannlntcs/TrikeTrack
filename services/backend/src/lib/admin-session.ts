import { NextResponse } from "next/server"
import { getAdminProfileByAuthUserId, type AdminProfile } from "./admin-auth-db"
import { getSupabaseUserFromAccessToken } from "./supabase-auth"

export type AdminSessionResult =
  | { profile: AdminProfile; response?: never }
  | { profile?: never; response: NextResponse }

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization") ?? ""
  if (!authorization.startsWith("Bearer ")) return null
  return authorization.slice("Bearer ".length).trim()
}

export const requireAdminSession = async (
  request: Request
): Promise<AdminSessionResult> => {
  const accessToken = getBearerToken(request)
  if (!accessToken) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message: "Missing bearer token."
        },
        { status: 401 }
      )
    }
  }

  const user = await getSupabaseUserFromAccessToken(accessToken)
  if (!user) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message: "Invalid or expired session."
        },
        { status: 401 }
      )
    }
  }

  const profile = await getAdminProfileByAuthUserId(user.id)
  if (!profile) {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message: "This user is not linked to an active admin account."
        },
        { status: 403 }
      )
    }
  }

  return { profile }
}

export const requireSuperadminSession = async (
  request: Request
): Promise<AdminSessionResult> => {
  const session = await requireAdminSession(request)
  if (session.response) return session

  if (session.profile.role !== "superadmin") {
    return {
      response: NextResponse.json(
        {
          ok: false,
          message: "This action requires a superadmin account."
        },
        { status: 403 }
      )
    }
  }

  return session
}
