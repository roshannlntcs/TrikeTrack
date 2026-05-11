import type { PoolClient } from "pg"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query, withTransaction } from "./database"
import {
  deletePassengerReportEvidence,
  uploadPassengerReportEvidence
} from "./supabase-storage"

export type ReportStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "resolved"
  | "dismissed"

export type ReportTypeRecord = {
  reportTypeId: number
  code: string
  label: string
}

export type PassengerReportContext = {
  qrId: number
  qrToken: string
  qrStatus?: "active" | "inactive" | "revoked" | "expired"
  qrIsActive?: boolean
  qrIssuedByAdmin?: boolean
  driverId: number
  driverCode: string
  driverName: string
  driverAvatarUrl?: string
  driverStatus: string
  driverCreatedByAdmin?: boolean
  driverIsVerified: boolean
  verificationStatus?: string
  verifiedAt?: string
  verifiedBy?: number
  tricycleId?: number
  plateNo?: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeId?: number
  tripId?: number
  tripStatus?: "scheduled" | "ongoing" | "completed" | "cancelled"
  tripStartedAt?: string
  tripEndedAt?: string
  routeName?: string
  latestDriverLocation?: {
    latitude: number
    longitude: number
    speed?: number
    heading?: number
    accuracy?: number
    recordedAt: string
    updatedAt?: string
    isOnline: boolean
  }
  fare?: {
    amount?: number
    currency: "PHP"
    label: string
    source: "trip" | "route" | "unavailable"
  }
  reportingAvailable: boolean
  availabilityMessage?: string
}

export type AdminReportRecord = {
  reportId: number
  scanId: number
  tripId?: number
  tripStatus?: "scheduled" | "ongoing" | "completed" | "cancelled"
  reportTypeId: number
  reportTypeCode: string
  reportTypeLabel: string
  passengerName?: string
  passengerContact?: string
  description: string
  reportedAt: string
  status: ReportStatus
  driverId: number
  driverCode: string
  driverName: string
  tricycleId?: number
  plateNo?: string
  qrId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeName?: string
  mediaUrls?: string[]
  violationId?: number
  violationStatus?: "open" | "under_review" | "resolved" | "dismissed"
}

export type CreatePassengerReportInput = {
  qrToken: string
  reportTypeCode: string
  description: string
  passengerName?: string
  passengerContact?: string
  deviceInfo?: Record<string, unknown>
  evidenceImage?: {
    dataUrl: string
    mimeType: string
    fileName?: string
  }
}

export type CreateSuspiciousQrReportInput = {
  qrToken: string
  reportTypeCode?: string
  description: string
  passengerName?: string
  passengerContact?: string
  deviceInfo?: Record<string, unknown>
}

type ReportTypeRow = {
  report_type_id: number
  code: string
  label: string
}

type PassengerReportContextRow = {
  qr_id: number
  qr_token: string
  qr_status: "active" | "inactive" | "revoked" | "expired"
  qr_issued_by_admin: boolean
  qr_expires_at: Date | null
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  avatar_url: string | null
  driver_status: string
  driver_created_by_admin: boolean
  driver_is_verified: boolean
  verification_status: string
  verified_at: Date | null
  verified_by: number | null
  tricycle_id: number | null
  plate_no: string | null
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  route_id: number | null
  trip_id: number | null
  trip_status: "scheduled" | "ongoing" | "completed" | "cancelled" | null
  trip_start: Date | null
  trip_end: Date | null
  route_name: string | null
  fare_amount: string | null
  default_fare_amount: string | null
  latest_latitude: number | null
  latest_longitude: number | null
  latest_speed: number | null
  latest_heading: number | null
  latest_accuracy: number | null
  latest_recorded_at: Date | null
  latest_updated_at: Date | null
  latest_is_online: boolean | null
}

type AdminReportRow = {
  report_id: number
  scan_id: number
  trip_id: number | null
  trip_status: "scheduled" | "ongoing" | "completed" | "cancelled" | null
  report_type_id: number
  report_type_code: string
  report_type_label: string
  passenger_name: string | null
  passenger_contact: string | null
  description: string
  reported_at: Date
  report_status: ReportStatus
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  tricycle_id: number | null
  plate_no: string | null
  qr_id: number
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  route_name: string | null
  media_urls: string[] | null
  violation_id: number | null
  violation_status: "open" | "under_review" | "resolved" | "dismissed" | null
}

type ReportTypeLookupRow = {
  report_type_id: number
}

type ReportViolationSourceRow = {
  report_type_code: string
  description: string
  reported_at: Date
  trip_id: number | null
  driver_id: number
  tricycle_id: number | null
}

type ScopeClause = {
  clause: string
  params: unknown[]
}

const REPORT_STATUS_VALUES = new Set<ReportStatus>([
  "submitted",
  "under_review",
  "verified",
  "resolved",
  "dismissed"
])

const PASSENGER_CONTEXT_SQL = `
  SELECT
    qr.qr_id,
    qr.qr_token,
    qr.status AS qr_status,
    qr.issued_by_admin AS qr_issued_by_admin,
    qr.expires_at AS qr_expires_at,
    d.driver_id,
    d.driver_code,
    d.first_name,
    d.last_name,
    d.avatar_url,
    d.status AS driver_status,
    d.created_by_admin AS driver_created_by_admin,
    d.is_verified AS driver_is_verified,
    d.verification_status,
    d.verified_at,
    d.verified_by,
    tr.tricycle_id,
    tr.plate_no,
    td.toda_id,
    td.toda_name,
    b.barangay_id,
    b.barangay_name,
    recent_trip.route_id,
    recent_trip.trip_id,
    recent_trip.trip_status,
    recent_trip.trip_start,
    recent_trip.trip_end,
    recent_trip.route_name,
    recent_trip.fare_amount,
    recent_trip.default_fare_amount,
    dl.latitude AS latest_latitude,
    dl.longitude AS latest_longitude,
    dl.speed AS latest_speed,
    dl.heading AS latest_heading,
    dl.accuracy AS latest_accuracy,
    dl.recorded_at AS latest_recorded_at,
    dl.updated_at AS latest_updated_at,
    dl.is_online AS latest_is_online
  FROM public.qr_codes qr
  JOIN public.drivers d
    ON d.driver_id = qr.driver_id
  LEFT JOIN public.tricycles tr
    ON tr.tricycle_id = COALESCE(qr.tricycle_id, d.tricycle_id)
  JOIN public.todas td
    ON td.toda_id = d.toda_id
  JOIN public.barangays b
    ON b.barangay_id = td.barangay_id
  LEFT JOIN LATERAL (
    SELECT
      tp.route_id,
      tp.trip_id,
      tp.trip_status,
      tp.trip_start,
      tp.trip_end,
      tp.fare_amount,
      r.default_fare_amount,
      r.origin || ' -> ' || r.destination AS route_name
    FROM public.trips tp
    LEFT JOIN public.routes r
      ON r.route_id = tp.route_id
    WHERE tp.driver_id = d.driver_id
      AND (tp.trip_status = 'ongoing' OR tp.trip_end >= NOW() - INTERVAL '24 hours')
    ORDER BY
      CASE WHEN tp.trip_status = 'ongoing' THEN 0 ELSE 1 END,
      COALESCE(tp.trip_end, tp.trip_start) DESC,
      tp.trip_id DESC
    LIMIT 1
  ) recent_trip
    ON TRUE
  LEFT JOIN public.driver_locations dl
    ON dl.driver_id = d.driver_id
  WHERE qr.qr_token = $1
  LIMIT 1
`

const buildScopeClause = (
  profile: AdminProfile,
  todaSql: string,
  barangaySql: string
): ScopeClause => {
  if (profile.role === "superadmin") {
    return { clause: "", params: [] }
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

  return { clause: "WHERE 1 = 0", params: [] }
}

const mapReportType = (row: ReportTypeRow): ReportTypeRecord => ({
  reportTypeId: Number(row.report_type_id),
  code: row.code,
  label: row.label
})

const mapPassengerReportContext = (
  row: PassengerReportContextRow
): PassengerReportContext => {
  return {
    qrId: Number(row.qr_id),
    qrToken: row.qr_token,
    qrStatus: row.qr_status,
    qrIsActive: row.qr_status === "active" && (!row.qr_expires_at || row.qr_expires_at > new Date()),
    qrIssuedByAdmin: row.qr_issued_by_admin,
    driverId: Number(row.driver_id),
    driverCode: row.driver_code,
    driverName: `${row.first_name} ${row.last_name}`,
    driverAvatarUrl: row.avatar_url ?? undefined,
    tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
    plateNo: row.plate_no ?? undefined,
    todaId: Number(row.toda_id),
    todaName: row.toda_name,
    barangayId: Number(row.barangay_id),
    barangayName: row.barangay_name,
    driverStatus: row.driver_status,
    driverCreatedByAdmin: row.driver_created_by_admin,
    driverIsVerified:
      row.driver_is_verified &&
      row.driver_created_by_admin &&
      Boolean(row.driver_code) &&
      row.driver_status === "active" &&
      row.qr_status === "active" &&
      row.qr_issued_by_admin &&
      (!row.qr_expires_at || row.qr_expires_at > new Date()) &&
      row.plate_no !== null,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at?.toISOString(),
    verifiedBy: row.verified_by === null ? undefined : Number(row.verified_by),
    routeId: row.route_id === null ? undefined : Number(row.route_id),
    tripId: row.trip_id === null ? undefined : Number(row.trip_id),
    tripStatus: row.trip_status ?? undefined,
    tripStartedAt: row.trip_start?.toISOString(),
    tripEndedAt: row.trip_end?.toISOString(),
    routeName: row.route_name ?? undefined,
    latestDriverLocation:
      row.latest_latitude === null ||
      row.latest_longitude === null ||
      row.latest_recorded_at === null ||
      row.latest_is_online === null
        ? undefined
        : {
            latitude: Number(row.latest_latitude),
            longitude: Number(row.latest_longitude),
            speed: row.latest_speed ?? undefined,
            heading: row.latest_heading ?? undefined,
            accuracy: row.latest_accuracy ?? undefined,
            recordedAt: row.latest_recorded_at.toISOString(),
            updatedAt: row.latest_updated_at?.toISOString(),
            isOnline: row.latest_is_online
          },
    fare:
      row.fare_amount !== null && Number(row.fare_amount) > 0
        ? {
            amount: Number(row.fare_amount),
            currency: "PHP",
            label: "Encoded trip fare",
            source: "trip"
          }
        : row.default_fare_amount !== null && Number(row.default_fare_amount) > 0
          ? {
              amount: Number(row.default_fare_amount),
              currency: "PHP",
              label: "Route default fare",
              source: "route"
            }
        : {
            currency: "PHP",
            label: "No encoded fare is available for this trip yet.",
            source: "unavailable"
          },
    reportingAvailable: true
  }
}

const mapAdminReport = (row: AdminReportRow): AdminReportRecord => ({
  reportId: Number(row.report_id),
  scanId: Number(row.scan_id),
  tripId: row.trip_id === null ? undefined : Number(row.trip_id),
  tripStatus: row.trip_status ?? undefined,
  reportTypeId: Number(row.report_type_id),
  reportTypeCode: row.report_type_code,
  reportTypeLabel: row.report_type_label,
  passengerName: row.passenger_name ?? undefined,
  passengerContact: row.passenger_contact ?? undefined,
  description: row.description,
  reportedAt: row.reported_at.toISOString(),
  status: row.report_status,
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  driverName: `${row.first_name} ${row.last_name}`,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  plateNo: row.plate_no ?? undefined,
  qrId: Number(row.qr_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  routeName: row.route_name ?? undefined,
  mediaUrls: row.media_urls ?? undefined,
  violationId: row.violation_id === null ? undefined : Number(row.violation_id),
  violationStatus: row.violation_status ?? undefined
})

const queryPassengerReportContext = async (
  qrToken: string,
  client?: PoolClient
): Promise<PassengerReportContextRow | null> => {
  const result = client
    ? await client.query<PassengerReportContextRow>(PASSENGER_CONTEXT_SQL, [qrToken])
    : await query<PassengerReportContextRow>(PASSENGER_CONTEXT_SQL, [qrToken])

  if (result.rows[0]) {
    return result.rows[0]
  }

  const fuzzySql = PASSENGER_CONTEXT_SQL.replace(
    "WHERE qr.qr_token = $1",
    "WHERE translate(qr.qr_token, '0O1Il', 'OOlll') = translate($1, '0O1Il', 'OOlll')"
  ).replace(/\n  LIMIT 1\n$/, "\n  LIMIT 2\n")

  const fuzzyResult = client
    ? await client.query<PassengerReportContextRow>(fuzzySql, [qrToken])
    : await query<PassengerReportContextRow>(fuzzySql, [qrToken])

  return fuzzyResult.rows.length === 1 ? fuzzyResult.rows[0] : null
}

const queryAdminReports = async (
  profile: AdminProfile,
  reportId?: number
): Promise<AdminReportRecord[]> => {
  const scope = buildScopeClause(profile, "td.toda_id", "b.barangay_id")
  const reportIdPosition = scope.params.length + 1
  const reportFilter = reportId ? `AND r.report_id = $${reportIdPosition}` : ""
  const params = reportId ? [...scope.params, reportId] : scope.params
  const result = await query<AdminReportRow>(
    `
      SELECT
        r.report_id,
        r.scan_id,
        r.trip_id,
        tp.trip_status,
        rt.report_type_id,
        rt.code AS report_type_code,
        rt.label AS report_type_label,
        r.passenger_name,
        r.passenger_contact,
        r.description,
        r.reported_at,
        r.status AS report_status,
        d.driver_id,
        d.driver_code,
        d.first_name,
        d.last_name,
        tr.tricycle_id,
        tr.plate_no,
        qr.qr_id,
        td.toda_id,
        td.toda_name,
        b.barangay_id,
        b.barangay_name,
        ro.origin || ' -> ' || ro.destination AS route_name,
        media.media_urls,
        v.violation_id,
        v.status AS violation_status
      FROM public.reports r
      JOIN public.report_types rt
        ON rt.report_type_id = r.report_type_id
      LEFT JOIN public.trips tp
        ON tp.trip_id = r.trip_id
      JOIN public.drivers d
        ON d.driver_id = r.driver_id
      JOIN public.qr_codes qr
        ON qr.qr_id = r.qr_id
      LEFT JOIN public.tricycles tr
        ON tr.tricycle_id = COALESCE(tp.tricycle_id, qr.tricycle_id, d.tricycle_id)
      LEFT JOIN public.routes ro
        ON ro.route_id = tp.route_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(rm.file_url ORDER BY rm.media_id ASC) AS media_urls
        FROM public.report_media rm
        WHERE rm.report_id = r.report_id
          AND rm.media_type = 'image'
      ) media
        ON TRUE
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      JOIN public.passenger_scans ps
        ON ps.scan_id = r.scan_id
      LEFT JOIN public.violations v
        ON v.report_id = r.report_id
      ${scope.clause ? `${scope.clause}\n        AND` : "WHERE"} 1 = 1
      ${reportFilter}
      ORDER BY r.reported_at DESC, r.report_id DESC
      LIMIT 250
    `,
    params
  )

  return result.rows.map(mapAdminReport)
}

const queryAdminReportByIdForTransaction = async (
  client: PoolClient,
  reportId: number
) => {
  const result = await client.query<AdminReportRow>(
    `
      SELECT
        r.report_id,
        r.scan_id,
        r.trip_id,
        tp.trip_status,
        rt.report_type_id,
        rt.code AS report_type_code,
        rt.label AS report_type_label,
        r.passenger_name,
        r.passenger_contact,
        r.description,
        r.reported_at,
        r.status AS report_status,
        d.driver_id,
        d.driver_code,
        d.first_name,
        d.last_name,
        tr.tricycle_id,
        tr.plate_no,
        qr.qr_id,
        td.toda_id,
        td.toda_name,
        b.barangay_id,
        b.barangay_name,
        ro.origin || ' -> ' || ro.destination AS route_name,
        media.media_urls,
        v.violation_id,
        v.status AS violation_status
      FROM public.reports r
      JOIN public.report_types rt
        ON rt.report_type_id = r.report_type_id
      LEFT JOIN public.trips tp
        ON tp.trip_id = r.trip_id
      JOIN public.drivers d
        ON d.driver_id = r.driver_id
      JOIN public.qr_codes qr
        ON qr.qr_id = r.qr_id
      LEFT JOIN public.tricycles tr
        ON tr.tricycle_id = COALESCE(tp.tricycle_id, qr.tricycle_id, d.tricycle_id)
      LEFT JOIN public.routes ro
        ON ro.route_id = tp.route_id
      LEFT JOIN LATERAL (
        SELECT ARRAY_AGG(rm.file_url ORDER BY rm.media_id ASC) AS media_urls
        FROM public.report_media rm
        WHERE rm.report_id = r.report_id
          AND rm.media_type = 'image'
      ) media
        ON TRUE
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      JOIN public.passenger_scans ps
        ON ps.scan_id = r.scan_id
      LEFT JOIN public.violations v
        ON v.report_id = r.report_id
      WHERE r.report_id = $1
      LIMIT 1
    `,
    [reportId]
  )

  const row = result.rows[0]
  return row ? mapAdminReport(row) : null
}

const syncViolationForReportStatus = async (
  client: PoolClient,
  reportId: number,
  status: ReportStatus
) => {
  const existingViolationResult = await client.query<{
    violation_id: number
  }>(
    `
      SELECT violation_id
      FROM public.violations
      WHERE report_id = $1
      LIMIT 1
    `,
    [reportId]
  )

  const existingViolationId = existingViolationResult.rows[0]?.violation_id
  if (status === "verified") {
    const sourceResult = await client.query<ReportViolationSourceRow>(
      `
        SELECT
          rt.code AS report_type_code,
          r.description,
          r.reported_at,
          r.driver_id,
          COALESCE(r.trip_id, ps.trip_id) AS trip_id,
          COALESCE(tp.tricycle_id, qr.tricycle_id, d.tricycle_id) AS tricycle_id
        FROM public.reports r
        JOIN public.report_types rt
          ON rt.report_type_id = r.report_type_id
        LEFT JOIN public.trips tp
          ON tp.trip_id = r.trip_id
        JOIN public.passenger_scans ps
          ON ps.scan_id = r.scan_id
        JOIN public.qr_codes qr
          ON qr.qr_id = r.qr_id
        JOIN public.drivers d
          ON d.driver_id = r.driver_id
        WHERE r.report_id = $1
        LIMIT 1
      `,
      [reportId]
    )

    const source = sourceResult.rows[0]
    if (!source) return

    const violationTypeResult = await client.query<{ violation_type_id: number }>(
      `
        SELECT violation_type_id
        FROM public.violation_types
        WHERE code = $1 OR code = 'other'
        ORDER BY CASE WHEN code = $1 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [source.report_type_code]
    )

    const violationTypeId = violationTypeResult.rows[0]?.violation_type_id
    if (!violationTypeId) return

    if (existingViolationId) {
      await client.query(
        `
          UPDATE public.violations
          SET
            violation_type_id = $2,
            trip_id = $3,
            driver_id = $4,
            tricycle_id = $5,
            description = $6,
            detected_at = $7,
            source = 'passenger_report',
            status = 'open'
          WHERE violation_id = $1
        `,
        [
          existingViolationId,
          violationTypeId,
          source.trip_id,
          source.driver_id,
          source.tricycle_id,
          source.description,
          source.reported_at
        ]
      )
      return
    }

    await client.query(
      `
        INSERT INTO public.violations (
          violation_type_id,
          trip_id,
          report_id,
          driver_id,
          tricycle_id,
          description,
          detected_at,
          source,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'passenger_report', 'open')
      `,
      [
        violationTypeId,
        source.trip_id,
        reportId,
        source.driver_id,
        source.tricycle_id,
        source.description,
        source.reported_at
      ]
    )
    return
  }

  const mappedViolationStatus =
    status === "under_review"
      ? "under_review"
      : status === "resolved"
        ? "resolved"
        : status === "dismissed"
          ? "dismissed"
          : null

  if (existingViolationId && mappedViolationStatus) {
    await client.query(
      `
        UPDATE public.violations
        SET status = $2
        WHERE violation_id = $1
      `,
      [existingViolationId, mappedViolationStatus]
    )
  }
}

export const isReportStatus = (value: unknown): value is ReportStatus =>
  typeof value === "string" && REPORT_STATUS_VALUES.has(value as ReportStatus)

export const listReportTypes = async () => {
  await ensureDatabaseReady()

  const result = await query<ReportTypeRow>(
    `
      SELECT
        report_type_id,
        code,
        label
      FROM public.report_types
      ORDER BY label ASC
    `
  )

  return result.rows.map(mapReportType)
}

export const getPassengerReportContextByQrToken = async (qrToken: string) => {
  await ensureDatabaseReady()
  const row = await queryPassengerReportContext(qrToken)
  return row ? mapPassengerReportContext(row) : null
}

export const createPassengerReport = async (input: CreatePassengerReportInput) => {
  await ensureDatabaseReady()

  let uploadedEvidencePath: string | null = null

  try {
    return await withTransaction(async (client) => {
      const contextRow = await queryPassengerReportContext(input.qrToken, client)
      if (!contextRow) {
        throw new Error("This QR code is invalid, inactive, or expired.")
      }

      const context = mapPassengerReportContext(contextRow)

      const reportTypeResult = await client.query<ReportTypeLookupRow>(
        `
          SELECT report_type_id
          FROM public.report_types
          WHERE code = $1
          LIMIT 1
        `,
        [input.reportTypeCode]
      )

      const reportTypeId = reportTypeResult.rows[0]?.report_type_id
      if (!reportTypeId) {
        throw new Error("Selected report category is invalid.")
      }

      const scanResult = await client.query<{ scan_id: number }>(
        `
          INSERT INTO public.passenger_scans (
            trip_id,
            driver_id,
            qr_id,
            device_info
          )
          VALUES ($1, $2, $3, $4)
          RETURNING scan_id
        `,
        [context.tripId ?? null, context.driverId, context.qrId, input.deviceInfo ?? {}]
      )

      const scanId = scanResult.rows[0]?.scan_id
      if (!scanId) {
        throw new Error("Unable to save passenger scan context.")
      }

      const reportResult = await client.query<{ report_id: number }>(
        `
          INSERT INTO public.reports (
            scan_id,
            trip_id,
            driver_id,
            qr_id,
            report_type_id,
            source,
            passenger_name,
            passenger_contact,
            description
          )
          VALUES ($1, $2, $3, $4, $5, 'qr_web_form', $6, $7, $8)
          RETURNING report_id
        `,
        [
          scanId,
          context.tripId ?? null,
          context.driverId,
          context.qrId,
          reportTypeId,
          input.passengerName ?? null,
          input.passengerContact ?? null,
          input.description
        ]
      )

      const reportId = reportResult.rows[0]?.report_id
      if (!reportId) {
        throw new Error("Unable to save passenger report.")
      }

      if (input.evidenceImage) {
        const evidenceMediaType =
          input.evidenceImage.mimeType.trim().toLowerCase() === "application/pdf"
            ? "document"
            : "image"
        const uploadedEvidence = await uploadPassengerReportEvidence({
          reportId,
          driverId: context.driverId,
          mimeType: input.evidenceImage.mimeType,
          dataUrl: input.evidenceImage.dataUrl,
          fileName: input.evidenceImage.fileName
        })

        uploadedEvidencePath = uploadedEvidence.objectPath

        await client.query(
          `
            INSERT INTO public.report_media (
              report_id,
              media_type,
              file_url
            )
            VALUES ($1, $2, $3)
          `,
          [reportId, evidenceMediaType, uploadedEvidence.publicUrl]
        )
      }

      const created = await queryAdminReportByIdForTransaction(client, reportId)
      if (!created) {
        throw new Error("Saved report could not be reloaded.")
      }

      return created
    })
  } catch (error) {
    if (uploadedEvidencePath) {
      await deletePassengerReportEvidence(uploadedEvidencePath).catch(() => null)
    }

    throw error
  }
}

export const createSuspiciousQrReport = async (input: CreateSuspiciousQrReportInput) => {
  await ensureDatabaseReady()

  const result = await query<{ suspicious_report_id: number; status: string }>(
    `
      INSERT INTO public.suspicious_qr_reports (
        qr_token,
        report_type_code,
        passenger_name,
        passenger_contact,
        description,
        device_info
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING suspicious_report_id, status
    `,
    [
      input.qrToken,
      input.reportTypeCode ?? "suspicious_qr",
      input.passengerName ?? null,
      input.passengerContact ?? null,
      input.description,
      input.deviceInfo ?? {}
    ]
  )

  const row = result.rows[0]
  if (!row) {
    throw new Error("Unable to submit suspicious QR report.")
  }

  return {
    reportId: Number(row.suspicious_report_id),
    status: row.status
  }
}

export const listReportsForAdmin = async (profile: AdminProfile) => {
  await ensureDatabaseReady()
  return queryAdminReports(profile)
}

export const updateReportStatusForAdmin = async (
  profile: AdminProfile,
  reportId: number,
  status: ReportStatus
) => {
  await ensureDatabaseReady()

  const existing = await queryAdminReports(profile, reportId)
  if (existing.length === 0) {
    throw new Error("Report not found in your admin scope.")
  }

  return withTransaction(async (client) => {
    const updateResult = await client.query<{ report_id: number }>(
      `
        UPDATE public.reports
        SET status = $2
        WHERE report_id = $1
        RETURNING report_id
      `,
      [reportId, status]
    )

    if (!updateResult.rows[0]?.report_id) {
      throw new Error("Unable to update report status.")
    }

    await syncViolationForReportStatus(client, reportId, status)

    const rows = await queryAdminReports(profile, reportId)
    const updated = rows[0]
    if (!updated) {
      throw new Error("Updated report is no longer available in your admin scope.")
    }

    return updated
  })
}
