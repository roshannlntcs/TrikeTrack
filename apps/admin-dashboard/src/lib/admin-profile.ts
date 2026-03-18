export type AdminProfile = {
  adminId: number
  authUserId: string
  email: string
  role: "superadmin" | "barangay_admin" | "toda_admin"
  status: "active" | "inactive" | "suspended"
  barangayId?: number
  barangayName?: string
  todaId?: number
  todaName?: string
  city?: string
}

type AuthMeResponse = {
  ok?: boolean
  message?: string
  profile?: AdminProfile
}

export const fetchAdminProfile = async (accessToken: string) => {
  try {
    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    const payload = (await response.json().catch(() => ({}))) as AuthMeResponse
    if (!response.ok || !payload.profile) {
      return {
        profile: null,
        error:
          payload.message ??
          (response.status === 403
            ? "This user is not linked to an active admin account."
            : `Admin API returned HTTP ${response.status}. Check the backend server.`)
      }
    }

    return {
      profile: payload.profile,
      error: null
    }
  } catch (error) {
    return {
      profile: null,
      error: `Unable to reach admin API: ${String(error)}`
    }
  }
}
