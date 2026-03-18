import { ensureDatabaseReady, query } from "./database"

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

type AdminProfileRow = {
  admin_id: number
  auth_user_id: string
  email: string
  admin_role: AdminProfile["role"]
  status: AdminProfile["status"]
  barangay_id: number | null
  barangay_name: string | null
  toda_id: number | null
  toda_name: string | null
  city: string | null
}

const mapAdminProfile = (row: AdminProfileRow): AdminProfile => ({
  adminId: Number(row.admin_id),
  authUserId: row.auth_user_id,
  email: row.email,
  role: row.admin_role,
  status: row.status,
  barangayId: row.barangay_id === null ? undefined : Number(row.barangay_id),
  barangayName: row.barangay_name ?? undefined,
  todaId: row.toda_id === null ? undefined : Number(row.toda_id),
  todaName: row.toda_name ?? undefined,
  city: row.city ?? undefined
})

export const getAdminProfileByAuthUserId = async (authUserId: string) => {
  await ensureDatabaseReady()

  const result = await query<AdminProfileRow>(
    `
      SELECT
        aa.admin_id,
        aa.auth_user_id,
        au.email,
        aa.admin_role,
        aa.status,
        COALESCE(aa.barangay_id, tb.barangay_id) AS barangay_id,
        COALESCE(b.barangay_name, tb.barangay_name) AS barangay_name,
        aa.toda_id,
        t.toda_name,
        COALESCE(b.city, tb.city) AS city
      FROM public.admin_accounts aa
      JOIN auth.users au
        ON au.id = aa.auth_user_id
      LEFT JOIN public.barangays b
        ON b.barangay_id = aa.barangay_id
      LEFT JOIN public.todas t
        ON t.toda_id = aa.toda_id
      LEFT JOIN public.barangays tb
        ON tb.barangay_id = t.barangay_id
      WHERE aa.auth_user_id = $1
        AND aa.status = 'active'
      LIMIT 1
    `,
    [authUserId]
  )

  const row = result.rows[0]
  return row ? mapAdminProfile(row) : null
}
