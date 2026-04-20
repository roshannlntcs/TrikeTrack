import { ensureDatabaseReady, hasTable, query } from "./database"
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
  decision_notes: string | null
  proof_urls: string[] | null
}

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
    decisionNotes: row.decision_notes ?? undefined,
    proofImageUrl: proofImageUrls[0] ?? undefined,
    proofImageUrls
  }
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
