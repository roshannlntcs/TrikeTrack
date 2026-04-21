import { ensureDatabaseReady, hasColumn, hasTable, query } from "./database"
import type { AdminProfile } from "./admin-auth-db"

export type AppealStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "denied"
  | "withdrawn"

export type AdminViolationAppealRecord = {
  appealId: string
  violationId: string
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeName?: string
  violationTypeCode: string
  violationTypeLabel: string
  violationStatus: "open" | "under_review" | "resolved"
  violationOccurredAt: string
  violationLocationLabel?: string
  appealReason: string
  appealMessage?: string
  status: AppealStatus
  submittedAt: string
  reviewedAt?: string
  viewedAt?: string
  viewedByAdminId?: number
  decisionNotes?: string
  proofImageUrl?: string
  proofImageUrls: string[]
}

type AdminViolationAppealRow = {
  appeal_id: string
  violation_id: string
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  tricycle_id: number | null
  plate_no: string | null
  trip_id: number | null
  route_origin: string | null
  route_destination: string | null
  violation_type_code: string
  violation_type_label: string
  violation_status: "open" | "under_review" | "resolved"
  violation_occurred_at: Date
  violation_location_label: string | null
  appeal_reason: string
  appeal_message: string | null
  appeal_status: AppealStatus
  submitted_at: Date
  reviewed_at: Date | null
  admin_viewed_at: Date | null
  admin_viewed_by_admin_id: number | null
  decision_notes: string | null
  proof_urls: string[] | null
}

let ensureAppealViewColumnsPromise: Promise<void> | undefined

const buildScopeClause = (
  profile: AdminProfile,
  todaSql: string,
  barangaySql: string
) => {
  if (profile.role === "superadmin") {
    return { clause: "", params: [] as unknown[] }
  }

  if (profile.role === "barangay_admin" && profile.barangayId) {
    return {
      clause: `WHERE ${barangaySql} = $1`,
      params: [profile.barangayId]
    }
  }

  if (profile.role === "toda_admin" && profile.todaId) {
    return {
      clause: `WHERE ${todaSql} = $1`,
      params: [profile.todaId]
    }
  }

  return { clause: "WHERE 1 = 0", params: [] as unknown[] }
}

const mapAppeal = (
  row: AdminViolationAppealRow
): AdminViolationAppealRecord => {
  const proofImageUrls = row.proof_urls ?? []

  return {
    appealId: row.appeal_id,
    violationId: row.violation_id,
    driverId: Number(row.driver_id),
    driverCode: row.driver_code,
    driverName: `${row.first_name} ${row.last_name}`,
    todaId: Number(row.toda_id),
    todaName: row.toda_name,
    barangayId: Number(row.barangay_id),
    barangayName: row.barangay_name,
    tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
    plateNo: row.plate_no ?? undefined,
    tripId: row.trip_id === null ? undefined : Number(row.trip_id),
    routeName:
      row.route_origin && row.route_destination
        ? `${row.route_origin} -> ${row.route_destination}`
        : undefined,
    violationTypeCode: row.violation_type_code,
    violationTypeLabel: row.violation_type_label,
    violationStatus: row.violation_status,
    violationOccurredAt: row.violation_occurred_at.toISOString(),
    violationLocationLabel: row.violation_location_label ?? undefined,
    appealReason: row.appeal_reason,
    appealMessage: row.appeal_message ?? undefined,
    status: row.appeal_status,
    submittedAt: row.submitted_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString(),
    viewedAt: row.admin_viewed_at?.toISOString(),
    viewedByAdminId:
      row.admin_viewed_by_admin_id === null
        ? undefined
        : Number(row.admin_viewed_by_admin_id),
    decisionNotes: row.decision_notes ?? undefined,
    proofImageUrl: proofImageUrls[0] ?? undefined,
    proofImageUrls
  }
}

const ensureAppealViewColumns = async () => {
  if (ensureAppealViewColumnsPromise) {
    return ensureAppealViewColumnsPromise
  }

  ensureAppealViewColumnsPromise = (async () => {
    const [hasViewedAtColumn, hasViewedByColumn] = await Promise.all([
      hasColumn("public", "violation_appeals", "admin_viewed_at"),
      hasColumn("public", "violation_appeals", "admin_viewed_by_admin_id")
    ])

    if (!hasViewedAtColumn) {
      await query(`
        ALTER TABLE public.violation_appeals
        ADD COLUMN IF NOT EXISTS admin_viewed_at timestamptz
      `)
    }

    if (!hasViewedByColumn) {
      await query(`
        ALTER TABLE public.violation_appeals
        ADD COLUMN IF NOT EXISTS admin_viewed_by_admin_id bigint
        REFERENCES public.admin_accounts(admin_id)
        ON DELETE SET NULL
      `)
      await query(`
        CREATE INDEX IF NOT EXISTS idx_violation_appeals_admin_viewed_by
        ON public.violation_appeals(admin_viewed_by_admin_id)
      `)
    }

    await query(`
      CREATE INDEX IF NOT EXISTS idx_violation_appeals_admin_viewed_at
      ON public.violation_appeals(admin_viewed_at DESC NULLS LAST)
    `)
  })().catch((error) => {
    ensureAppealViewColumnsPromise = undefined
    throw error
  })

  return ensureAppealViewColumnsPromise
}

export const listAppealsForAdmin = async (profile: AdminProfile) => {
  await ensureDatabaseReady()

  const [hasAppealsTable, hasMobileViolationsTable, hasProofsTable] = await Promise.all([
    hasTable("public", "violation_appeals"),
    hasTable("public", "mobile_violations"),
    hasTable("public", "violation_proofs")
  ])

  if (!hasAppealsTable || !hasMobileViolationsTable) {
    return [] as AdminViolationAppealRecord[]
  }

  await ensureAppealViewColumns()

  const scope = buildScopeClause(profile, "td.toda_id", "b.barangay_id")
  const proofSelect = hasProofsTable
    ? `COALESCE(proofs.proof_urls, ARRAY[]::text[]) AS proof_urls`
    : `ARRAY[]::text[] AS proof_urls`
  const proofJoin = hasProofsTable
    ? `
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(vp.file_url ORDER BY vp.uploaded_at DESC, vp.id DESC) AS proof_urls
        FROM public.violation_proofs vp
        WHERE vp.violation_id = mv.id
          AND vp.driver_id = va.driver_id
      ) proofs
        ON TRUE
    `
    : ""

  const result = await query<AdminViolationAppealRow>(
    `
      SELECT
        va.id::text AS appeal_id,
        mv.id::text AS violation_id,
        d.driver_id,
        d.driver_code,
        d.first_name,
        d.last_name,
        td.toda_id,
        td.toda_name,
        b.barangay_id,
        b.barangay_name,
        d.tricycle_id,
        tr.plate_no,
        tp.trip_id,
        r.origin AS route_origin,
        r.destination AS route_destination,
        LOWER(mv.type::text) AS violation_type_code,
        INITCAP(REPLACE(LOWER(mv.type::text), '_', ' ')) AS violation_type_label,
        LOWER(mv.status::text)::text AS violation_status,
        mv.occurred_at AS violation_occurred_at,
        mv.location_label AS violation_location_label,
        va.reason AS appeal_reason,
        va.details AS appeal_message,
        LOWER(va.status::text)::text AS appeal_status,
        va.submitted_at,
        va.reviewed_at,
        va.admin_viewed_at,
        va.admin_viewed_by_admin_id,
        va.decision_notes,
        ${proofSelect}
      FROM public.violation_appeals va
      JOIN public.mobile_violations mv
        ON mv.id = va.violation_id
      JOIN public.drivers d
        ON d.driver_id = va.driver_id
      LEFT JOIN public.tricycles tr
        ON tr.tricycle_id = d.tricycle_id
      LEFT JOIN public.trips tp
        ON tp.trip_id = mv.trip_id
      LEFT JOIN public.routes r
        ON r.route_id = tp.route_id
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      ${proofJoin}
      ${scope.clause}
      ORDER BY va.submitted_at DESC, va.id DESC
      LIMIT 250
    `,
    scope.params
  )

  return result.rows.map(mapAppeal)
}

export const markAppealViewedForAdmin = async (
  profile: AdminProfile,
  appealId: string
) => {
  await ensureDatabaseReady()

  const [hasAppealsTable, hasMobileViolationsTable] = await Promise.all([
    hasTable("public", "violation_appeals"),
    hasTable("public", "mobile_violations")
  ])

  if (!hasAppealsTable || !hasMobileViolationsTable) {
    throw new Error("Driver appeals are not available.")
  }

  await ensureAppealViewColumns()

  const scope = buildScopeClause(profile, "td.toda_id", "b.barangay_id")
  const params = [appealId.trim(), profile.adminId, ...scope.params]
  const appealIdParam = "$1"
  const adminIdParam = "$2"
  const scopeClause = scope.clause
    ? scope.clause
        .replace(/^WHERE\s+/i, "AND ")
        .replace(/\$(\d+)/g, (_, index: string) => `$${Number(index) + 2}`)
    : ""

  const result = await query<{
    appeal_id: string
    admin_viewed_at: Date
    admin_viewed_by_admin_id: number | null
  }>(
    `
      WITH scoped_appeal AS (
        SELECT va.id
        FROM public.violation_appeals va
        JOIN public.mobile_violations mv
          ON mv.id = va.violation_id
        JOIN public.drivers d
          ON d.driver_id = va.driver_id
        JOIN public.todas td
          ON td.toda_id = d.toda_id
        JOIN public.barangays b
          ON b.barangay_id = td.barangay_id
        WHERE va.id::text = ${appealIdParam}
        ${scopeClause ? ` ${scopeClause}` : ""}
        LIMIT 1
      )
      UPDATE public.violation_appeals va
      SET
        admin_viewed_at = COALESCE(va.admin_viewed_at, NOW()),
        admin_viewed_by_admin_id = COALESCE(va.admin_viewed_by_admin_id, ${adminIdParam})
      WHERE va.id IN (SELECT id FROM scoped_appeal)
      RETURNING
        va.id::text AS appeal_id,
        va.admin_viewed_at,
        va.admin_viewed_by_admin_id
    `,
    params
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Appeal not found in your admin scope.")
  }

  return {
    appealId: row.appeal_id,
    viewedAt: row.admin_viewed_at.toISOString(),
    viewedByAdminId:
      row.admin_viewed_by_admin_id === null ? undefined : Number(row.admin_viewed_by_admin_id)
  }
}
