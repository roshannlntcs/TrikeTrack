import type { PoolClient } from "pg"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, query, withTransaction } from "./database"

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
  tricycleId: number
  plateNo: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  driverId?: number
  driverCode?: string
  driverName?: string
  tripId?: number
  tripStatus?: "scheduled" | "ongoing" | "completed" | "cancelled"
  tripStartedAt?: string
  tripEndedAt?: string
  routeName?: string
  reportingAvailable: boolean
  availabilityMessage?: string
}

export type AdminReportRecord = {
  reportId: number
  scanId: number
  tripId: number
  tripStatus: "scheduled" | "ongoing" | "completed" | "cancelled"
  reportTypeId: number
  reportTypeCode: string
  reportTypeLabel: string
  description: string
  reportedAt: string
  status: ReportStatus
  driverId: number
  driverCode: string
  driverName: string
  tricycleId: number
  plateNo: string
  qrId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  routeName: string
  violationId?: number
  violationStatus?: "open" | "under_review" | "resolved" | "dismissed"
}

export type CreatePassengerReportInput = {
  qrToken: string
  reportTypeCode: string
  description: string
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
  tricycle_id: number
  plate_no: string
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  driver_id: number | null
  driver_code: string | null
  first_name: string | null
  last_name: string | null
  trip_id: number | null
  trip_status: "scheduled" | "ongoing" | "completed" | "cancelled" | null
  trip_start: Date | null
  trip_end: Date | null
  route_name: string | null
}

type AdminReportRow = {
  report_id: number
  scan_id: number
  trip_id: number
  trip_status: "scheduled" | "ongoing" | "completed" | "cancelled"
  report_type_id: number
  report_type_code: string
  report_type_label: string
  description: string
  reported_at: Date
  report_status: ReportStatus
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  tricycle_id: number
  plate_no: string
  qr_id: number
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  route_name: string
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
  trip_id: number
  driver_id: number
  tricycle_id: number
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
    tr.tricycle_id,
    tr.plate_no,
    td.toda_id,
    td.toda_name,
    b.barangay_id,
    b.barangay_name,
    latest.driver_id,
    latest.driver_code,
    latest.first_name,
    latest.last_name,
    latest.trip_id,
    latest.trip_status,
    latest.trip_start,
    latest.trip_end,
    latest.route_name
  FROM public.qr_codes qr
  JOIN public.tricycles tr
    ON tr.tricycle_id = qr.tricycle_id
  JOIN public.todas td
    ON td.toda_id = tr.toda_id
  JOIN public.barangays b
    ON b.barangay_id = td.barangay_id
  LEFT JOIN LATERAL (
    SELECT
      tp.trip_id,
      tp.trip_status,
      tp.trip_start,
      tp.trip_end,
      d.driver_id,
      d.driver_code,
      d.first_name,
      d.last_name,
      r.origin || ' -> ' || r.destination AS route_name
    FROM public.trips tp
    JOIN public.drivers d
      ON d.driver_id = tp.driver_id
    JOIN public.routes r
      ON r.route_id = tp.route_id
    WHERE tp.tricycle_id = tr.tricycle_id
      AND (tp.trip_status = 'ongoing' OR tp.trip_end >= NOW() - INTERVAL '24 hours')
    ORDER BY
      CASE WHEN tp.trip_status = 'ongoing' THEN 0 ELSE 1 END,
      COALESCE(tp.trip_end, tp.trip_start) DESC,
      tp.trip_id DESC
    LIMIT 1
  ) latest
    ON TRUE
  WHERE qr.qr_token = $1
    AND qr.status = 'active'
    AND (qr.expires_at IS NULL OR qr.expires_at > NOW())
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
  const hasTrip = row.trip_id !== null
  const driverName =
    row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : undefined

  return {
    qrId: Number(row.qr_id),
    qrToken: row.qr_token,
    tricycleId: Number(row.tricycle_id),
    plateNo: row.plate_no,
    todaId: Number(row.toda_id),
    todaName: row.toda_name,
    barangayId: Number(row.barangay_id),
    barangayName: row.barangay_name,
    driverId: row.driver_id === null ? undefined : Number(row.driver_id),
    driverCode: row.driver_code ?? undefined,
    driverName,
    tripId: row.trip_id === null ? undefined : Number(row.trip_id),
    tripStatus: row.trip_status ?? undefined,
    tripStartedAt: row.trip_start?.toISOString(),
    tripEndedAt: row.trip_end?.toISOString(),
    routeName: row.route_name ?? undefined,
    reportingAvailable: hasTrip,
    availabilityMessage: hasTrip
      ? undefined
      : "No ongoing or recent trip is currently linked to this QR code."
  }
}

const mapAdminReport = (row: AdminReportRow): AdminReportRecord => ({
  reportId: Number(row.report_id),
  scanId: Number(row.scan_id),
  tripId: Number(row.trip_id),
  tripStatus: row.trip_status,
  reportTypeId: Number(row.report_type_id),
  reportTypeCode: row.report_type_code,
  reportTypeLabel: row.report_type_label,
  description: row.description,
  reportedAt: row.reported_at.toISOString(),
  status: row.report_status,
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  driverName: `${row.first_name} ${row.last_name}`,
  tricycleId: Number(row.tricycle_id),
  plateNo: row.plate_no,
  qrId: Number(row.qr_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  routeName: row.route_name,
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

  return result.rows[0] ?? null
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
        v.violation_id,
        v.status AS violation_status
      FROM public.reports r
      JOIN public.report_types rt
        ON rt.report_type_id = r.report_type_id
      JOIN public.trips tp
        ON tp.trip_id = r.trip_id
      JOIN public.drivers d
        ON d.driver_id = tp.driver_id
      JOIN public.tricycles tr
        ON tr.tricycle_id = tp.tricycle_id
      JOIN public.routes ro
        ON ro.route_id = tp.route_id
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      JOIN public.passenger_scans ps
        ON ps.scan_id = r.scan_id
      JOIN public.qr_codes qr
        ON qr.qr_id = ps.qr_id
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
        v.violation_id,
        v.status AS violation_status
      FROM public.reports r
      JOIN public.report_types rt
        ON rt.report_type_id = r.report_type_id
      JOIN public.trips tp
        ON tp.trip_id = r.trip_id
      JOIN public.drivers d
        ON d.driver_id = tp.driver_id
      JOIN public.tricycles tr
        ON tr.tricycle_id = tp.tricycle_id
      JOIN public.routes ro
        ON ro.route_id = tp.route_id
      JOIN public.todas td
        ON td.toda_id = d.toda_id
      JOIN public.barangays b
        ON b.barangay_id = td.barangay_id
      JOIN public.passenger_scans ps
        ON ps.scan_id = r.scan_id
      JOIN public.qr_codes qr
        ON qr.qr_id = ps.qr_id
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
          r.trip_id,
          tp.driver_id,
          tp.tricycle_id
        FROM public.reports r
        JOIN public.report_types rt
          ON rt.report_type_id = r.report_type_id
        JOIN public.trips tp
          ON tp.trip_id = r.trip_id
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

  return withTransaction(async (client) => {
    const contextRow = await queryPassengerReportContext(input.qrToken, client)
    if (!contextRow) {
      throw new Error("This QR code is invalid, inactive, or expired.")
    }

    const context = mapPassengerReportContext(contextRow)
    if (!context.reportingAvailable || !context.tripId) {
      throw new Error(
        context.availabilityMessage ??
          "This QR code does not have an ongoing or recent trip available for reporting."
      )
    }

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
          qr_id,
          device_info
        )
        VALUES ($1, $2, $3)
        RETURNING scan_id
      `,
      [context.tripId, context.qrId, input.deviceInfo ?? {}]
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
          report_type_id,
          description
        )
        VALUES ($1, $2, $3, $4)
        RETURNING report_id
      `,
      [scanId, context.tripId, reportTypeId, input.description]
    )

    const reportId = reportResult.rows[0]?.report_id
    if (!reportId) {
      throw new Error("Unable to save passenger report.")
    }

    const created = await queryAdminReportByIdForTransaction(client, reportId)
    if (!created) {
      throw new Error("Saved report could not be reloaded.")
    }

    return created
  })
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
