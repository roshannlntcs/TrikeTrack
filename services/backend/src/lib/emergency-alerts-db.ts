import { randomUUID } from "crypto"
import type { PoolClient } from "pg"
import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, hasTable, query, withTransaction } from "./database"

export type EmergencyAlertStatus =
  | "created"
  | "pending_admin"
  | "acknowledged"
  | "responding"
  | "resolved"

export type EmergencyAlertRecord = {
  emergencyId: number
  passengerTrackingKey: string
  qrId: number
  qrToken: string
  driverId: number
  driverCode: string
  driverName: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeId?: number
  routeName?: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  source: string
  alertType: string
  status: EmergencyAlertStatus
  latitude?: number
  longitude?: number
  locationLabel?: string
  createdAt: string
  updatedAt: string
  acknowledgedAt?: string
  resolvedAt?: string
  acknowledgedByAdminId?: number
  acknowledgedByAdminEmail?: string
}

export type EmergencyAlertRealtimeEvent = {
  type: "upsert"
  alert: EmergencyAlertRecord
}

export type CreatePassengerEmergencyAlertInput = {
  qrToken: string
  deviceInfo?: Record<string, unknown>
}

type EmergencyContextRow = {
  qr_id: number
  qr_token: string
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  tricycle_id: number | null
  plate_no: string | null
  trip_id: number | null
  route_id: number | null
  route_name: string | null
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
}

type EmergencyAlertRow = {
  emergency_id: number
  passenger_tracking_key: string
  qr_id: number
  qr_token: string
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  tricycle_id: number | null
  plate_no: string | null
  trip_id: number | null
  route_id: number | null
  route_origin: string | null
  route_destination: string | null
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  source: string
  alert_type: string
  status: EmergencyAlertStatus
  latitude: number | null
  longitude: number | null
  location_label: string | null
  created_at: Date
  updated_at: Date
  acknowledged_at: Date | null
  resolved_at: Date | null
  acknowledged_by_admin_id: number | null
  acknowledged_by_admin_email: string | null
}

const EMERGENCY_ALERTS_CHANNEL = "emergency_alerts"

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

const mapEmergencyAlert = (row: EmergencyAlertRow): EmergencyAlertRecord => ({
  emergencyId: Number(row.emergency_id),
  passengerTrackingKey: row.passenger_tracking_key,
  qrId: Number(row.qr_id),
  qrToken: row.qr_token,
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  driverName: `${row.first_name} ${row.last_name}`,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  plateNo: row.plate_no ?? undefined,
  tripId: row.trip_id === null ? undefined : Number(row.trip_id),
  routeId: row.route_id === null ? undefined : Number(row.route_id),
  routeName:
    row.route_origin && row.route_destination
      ? `${row.route_origin} -> ${row.route_destination}`
      : undefined,
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  source: row.source,
  alertType: row.alert_type,
  status: row.status,
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  locationLabel: row.location_label ?? undefined,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  acknowledgedAt: row.acknowledged_at?.toISOString(),
  resolvedAt: row.resolved_at?.toISOString(),
  acknowledgedByAdminId:
    row.acknowledged_by_admin_id === null
      ? undefined
      : Number(row.acknowledged_by_admin_id),
  acknowledgedByAdminEmail: row.acknowledged_by_admin_email ?? undefined
})

const EMERGENCY_CONTEXT_SQL = `
  SELECT
    qr.qr_id,
    qr.qr_token,
    d.driver_id,
    d.driver_code,
    d.first_name,
    d.last_name,
    COALESCE(qr.tricycle_id, d.tricycle_id) AS tricycle_id,
    tr.plate_no,
    recent_trip.trip_id,
    recent_trip.route_id,
    recent_trip.route_name,
    td.toda_id,
    td.toda_name,
    b.barangay_id,
    b.barangay_name
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
      tp.trip_id,
      tp.route_id,
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
  WHERE qr.qr_token = $1
    AND qr.status = 'active'
    AND (qr.expires_at IS NULL OR qr.expires_at > NOW())
  LIMIT 1
`

const EMERGENCY_SELECT = `
  SELECT
    e.emergency_id,
    e.passenger_tracking_key::text AS passenger_tracking_key,
    e.qr_id,
    e.qr_token,
    e.driver_id,
    d.driver_code,
    d.first_name,
    d.last_name,
    e.tricycle_id,
    tr.plate_no,
    e.trip_id,
    e.route_id,
    r.origin AS route_origin,
    r.destination AS route_destination,
    e.toda_id,
    td.toda_name,
    e.barangay_id,
    b.barangay_name,
    e.source,
    e.alert_type,
    e.status::text AS status,
    e.latitude,
    e.longitude,
    e.location_label,
    e.created_at,
    e.updated_at,
    e.acknowledged_at,
    e.resolved_at,
    e.acknowledged_by_admin_id,
    au.email AS acknowledged_by_admin_email
  FROM public.emergency_alerts e
  JOIN public.drivers d
    ON d.driver_id = e.driver_id
  LEFT JOIN public.tricycles tr
    ON tr.tricycle_id = e.tricycle_id
  LEFT JOIN public.routes r
    ON r.route_id = e.route_id
  JOIN public.todas td
    ON td.toda_id = e.toda_id
  JOIN public.barangays b
    ON b.barangay_id = e.barangay_id
  LEFT JOIN public.admin_accounts aa
    ON aa.admin_id = e.acknowledged_by_admin_id
  LEFT JOIN auth.users au
    ON au.id = aa.auth_user_id
`

const ensureEmergencyAlertsTable = async () => {
  const exists = await hasTable("public", "emergency_alerts")
  if (!exists) {
    throw new Error(
      "Emergency alerts are not set up yet. Run services/backend/db/add_emergency_alerts.sql in Supabase first."
    )
  }
}

const queryEmergencyContext = async (
  qrToken: string,
  client?: PoolClient
): Promise<EmergencyContextRow | null> => {
  const result = client
    ? await client.query<EmergencyContextRow>(EMERGENCY_CONTEXT_SQL, [qrToken])
    : await query<EmergencyContextRow>(EMERGENCY_CONTEXT_SQL, [qrToken])

  return result.rows[0] ?? null
}

const queryEmergencyById = async (
  emergencyId: number,
  client?: PoolClient
): Promise<EmergencyAlertRecord | null> => {
  const sql = `${EMERGENCY_SELECT} WHERE e.emergency_id = $1 LIMIT 1`
  const result = client
    ? await client.query<EmergencyAlertRow>(sql, [emergencyId])
    : await query<EmergencyAlertRow>(sql, [emergencyId])

  const row = result.rows[0]
  return row ? mapEmergencyAlert(row) : null
}

const notifyEmergencyEvent = async (
  client: PoolClient,
  alert: EmergencyAlertRecord
) => {
  const payload: EmergencyAlertRealtimeEvent = {
    type: "upsert",
    alert
  }

  await client.query("SELECT pg_notify($1, $2)", [
    EMERGENCY_ALERTS_CHANNEL,
    JSON.stringify(payload)
  ])
}

export const isEmergencyVisibleToAdmin = (
  profile: AdminProfile,
  alert: Partial<Pick<EmergencyAlertRecord, "todaId" | "barangayId">>
) => {
  if (profile.role === "superadmin") return true
  if (profile.role === "barangay_admin") {
    return alert.barangayId !== undefined && profile.barangayId === alert.barangayId
  }
  if (profile.role === "toda_admin") {
    return alert.todaId !== undefined && profile.todaId === alert.todaId
  }
  return false
}

export const listEmergencyAlertsForAdmin = async (
  profile: AdminProfile,
  options?: {
    onlyActive?: boolean
    limit?: number
    emergencyId?: number
  }
) => {
  await ensureDatabaseReady()
  const exists = await hasTable("public", "emergency_alerts")
  if (!exists) {
    return [] as EmergencyAlertRecord[]
  }

  const scope = buildScopeClause(profile, "e.toda_id", "e.barangay_id")
  const params = [...scope.params]
  const clauses = [scope.clause ? scope.clause.replace(/^WHERE\s+/i, "") : "1 = 1"]

  if (options?.onlyActive) {
    clauses.push("e.status <> 'resolved'")
  }

  if (options?.emergencyId) {
    params.push(options.emergencyId)
    clauses.push(`e.emergency_id = $${params.length}`)
  }

  params.push(options?.limit ?? 50)

  const result = await query<EmergencyAlertRow>(
    `
      ${EMERGENCY_SELECT}
      WHERE ${clauses.join(" AND ")}
      ORDER BY e.created_at DESC, e.emergency_id DESC
      LIMIT $${params.length}
    `,
    params
  )

  return result.rows.map(mapEmergencyAlert)
}

export const getPassengerEmergencyAlertByTrackingKey = async (
  trackingKey: string
) => {
  await ensureDatabaseReady()
  const exists = await hasTable("public", "emergency_alerts")
  if (!exists) {
    return null
  }

  const result = await query<EmergencyAlertRow>(
    `
      ${EMERGENCY_SELECT}
      WHERE e.passenger_tracking_key = $1::uuid
      LIMIT 1
    `,
    [trackingKey]
  )

  const row = result.rows[0]
  return row ? mapEmergencyAlert(row) : null
}

export const createPassengerEmergencyAlert = async (
  input: CreatePassengerEmergencyAlertInput
) => {
  await ensureDatabaseReady()
  await ensureEmergencyAlertsTable()

  return withTransaction(async (client) => {
    const context = await queryEmergencyContext(input.qrToken, client)
    if (!context) {
      throw new Error("This QR code is invalid, inactive, or expired.")
    }

    const trackingKey = randomUUID()
    const insertResult = await client.query<{ emergency_id: number }>(
      `
        INSERT INTO public.emergency_alerts (
          passenger_tracking_key,
          qr_id,
          qr_token,
          driver_id,
          tricycle_id,
          trip_id,
          route_id,
          toda_id,
          barangay_id,
          source,
          alert_type,
          status,
          location_label,
          device_info,
          updated_at
        )
        VALUES (
          $1::uuid,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'qr_emergency_button',
          'emergency',
          'pending_admin',
          $10,
          $11,
          NOW()
        )
        RETURNING emergency_id
      `,
      [
        trackingKey,
        context.qr_id,
        context.qr_token,
        context.driver_id,
        context.tricycle_id,
        context.trip_id,
        context.route_id,
        context.toda_id,
        context.barangay_id,
        context.route_name,
        input.deviceInfo ?? {}
      ]
    )

    const emergencyId = insertResult.rows[0]?.emergency_id
    if (!emergencyId) {
      throw new Error("Unable to create emergency alert.")
    }

    const alert = await queryEmergencyById(emergencyId, client)
    if (!alert) {
      throw new Error("Created emergency alert could not be reloaded.")
    }

    await notifyEmergencyEvent(client, alert)

    return alert
  })
}

export const updateEmergencyAlertStatusForAdmin = async (
  profile: AdminProfile,
  emergencyId: number,
  status: Extract<EmergencyAlertStatus, "acknowledged" | "responding" | "resolved">
) => {
  await ensureDatabaseReady()
  await ensureEmergencyAlertsTable()

  const existing = await listEmergencyAlertsForAdmin(profile, {
    emergencyId,
    limit: 1
  })
  if (existing.length === 0) {
    throw new Error("Emergency alert not found in your admin scope.")
  }

  return withTransaction(async (client) => {
    const isAcknowledgedStatus = status === "acknowledged" || status === "responding"
    const result = await client.query<{ emergency_id: number }>(
      `
        UPDATE public.emergency_alerts
        SET
          status = $2::public.emergency_alert_status,
          acknowledged_by_admin_id = CASE
            WHEN $2::text IN ('acknowledged', 'responding') AND acknowledged_by_admin_id IS NULL THEN $3
            ELSE acknowledged_by_admin_id
          END,
          acknowledged_at = CASE
            WHEN $2::text IN ('acknowledged', 'responding') AND acknowledged_at IS NULL THEN NOW()
            ELSE acknowledged_at
          END,
          resolved_at = CASE
            WHEN $2::text = 'resolved' THEN NOW()
            ELSE resolved_at
          END,
          updated_at = NOW()
        WHERE emergency_id = $1
        RETURNING emergency_id
      `,
      [emergencyId, status, profile.adminId]
    )

    if (!result.rows[0]?.emergency_id) {
      throw new Error("Unable to update emergency alert.")
    }

    const alert = await queryEmergencyById(emergencyId, client)
    if (!alert) {
      throw new Error("Updated emergency alert could not be reloaded.")
    }

    await notifyEmergencyEvent(client, {
      ...alert,
      acknowledgedByAdminId:
        isAcknowledgedStatus && alert.acknowledgedByAdminId === undefined
          ? profile.adminId
          : alert.acknowledgedByAdminId
    })

    return alert
  })
}

export const getEmergencyAlertsChannelName = () => EMERGENCY_ALERTS_CHANNEL
