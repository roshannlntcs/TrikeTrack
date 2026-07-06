import type { AdminProfile } from "./admin-auth-db"
import { ensureDatabaseReady, hasColumn, hasTable, query } from "./database"
import {
  listAppealsForAdmin,
  type AdminViolationAppealRecord
} from "./appeals-db"
import {
  listEmergencyAlertsForAdmin,
  type EmergencyAlertRecord
} from "./emergency-alerts-db"
import { runOperationalAnomalyDetection } from "./operational-anomalies-db"
import { ensureViolationStorageReady } from "./violations-db"
import {
  ensureDriverPasswordResetReady,
  listDriverPasswordResetRequestsForAdmin,
  type DriverPasswordResetRequestRecord
} from "./driver-password-reset-db"

export type DashboardDriverRecord = {
  driverId: number
  driverCode: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  tricycleNo?: string
  qrId?: number
  passwordSet: boolean
  firstName: string
  lastName: string
  contactNo?: string
  avatarUrl?: string
  status: "active" | "inactive" | "suspended"
  createdAt: string
}

export type DashboardTricycleRecord = {
  tricycleId: number
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  plateNo: string
  regNo?: string
  permitExpirationDate?: string
  status: "active" | "inactive" | "suspended"
  createdAt: string
}

export type DashboardOperationalDriverStatus =
  | "offline"
  | "online_idle"
  | "on_trip"
  | "inactive"
  | "suspended"

export type DashboardOperationalDriverRecord = {
  driverId: number
  driverCode: string
  driverName: string
  todaId: number
  todaName: string
  barangayId: number
  barangayName: string
  tricycleId?: number
  plateNo?: string
  accountStatus: DashboardDriverRecord["status"]
  operationalStatus: DashboardOperationalDriverStatus
  isOnline: boolean
  lastUpdateAt?: string
  latitude?: number
  longitude?: number
  speed?: number
  heading?: number
  accuracy?: number
  activeTripId?: number
  activeTripStartedAt?: string
  activeRouteId?: number
  activeRouteName?: string
  totalAlertCount: number
  openAlertCount: number
}

export type DashboardViolationStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "dismissed"

export type DashboardViolationSeverity = "high" | "medium" | "low"

export type DashboardViolationRecord = {
  violationId: string
  alertSource: "system_violation" | "driver_violation"
  reportId?: number
  driverId?: number
  driverCode?: string
  driverName?: string
  todaName?: string
  barangayName?: string
  tricycleId?: number
  plateNo?: string
  tripId?: number
  routeId?: number
  routeName?: string
  violationTypeCode: string
  violationTypeLabel: string
  severity: DashboardViolationSeverity
  description?: string
  locationLabel?: string
  latitude?: number
  longitude?: number
  detectedAt: string
  status: DashboardViolationStatus
}

export type DashboardEmergencyRecord = EmergencyAlertRecord

export type DashboardTripRecord = {
  tripId: number
  driverId: number
  driverCode: string
  driverName: string
  todaName: string
  barangayName: string
  tricycleId: number
  plateNo: string
  routeId: number
  routeName: string
  tripStart: string
  tripEnd?: string
  tripStatus: "scheduled" | "ongoing" | "completed" | "cancelled"
  durationMinutes?: number
  fareAmount?: number
  distanceKm?: number
  hasPath: boolean
  pathPointCount?: number
  pathUpdatedAt?: string
  violationCount: number
  reportCount: number
  issueCount: number
  relatedReports: DashboardTripReportRecord[]
  createdAt: string
}

export type DashboardTripReportRecord = {
  reportId: number
  reportTypeLabel: string
  passengerName?: string
  description: string
  reportedAt: string
  status: string
}

export type DashboardNotificationRecord = {
  notificationKey: string
  kind: "violation" | "trip" | "driver" | "emergency" | "appeal" | "password_reset"
  page: "alerts" | "trip-logs" | "drivers" | "reports"
  title: string
  body: string
  timestamp: string
  priority: number
  tone: "danger" | "warn" | "info"
  sourceEntityType: "alert" | "trip" | "driver" | "emergency" | "appeal" | "password_reset"
  sourceEntityId: string
  isRead: boolean
}

export type DashboardDataSnapshot = {
  drivers: DashboardDriverRecord[]
  tricycles: DashboardTricycleRecord[]
  operationalDrivers: DashboardOperationalDriverRecord[]
  recentViolations: DashboardViolationRecord[]
  recentEmergencies: DashboardEmergencyRecord[]
  recentTrips: DashboardTripRecord[]
  passwordResetRequests: DriverPasswordResetRequestRecord[]
  notifications: DashboardNotificationRecord[]
  counts: {
    drivers: number
    tricycles: number
    onlineDrivers: number
    activeTricycles: number
    ongoingTrips: number
    tripsToday: number
    completedTripsToday: number
    openAlerts: number
    unreadNotifications: number
  }
}

type DashboardDriverRow = {
  driver_id: number
  driver_code: string
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  tricycle_id: number | null
  plate_no: string | null
  qr_id: number | null
  password_hash: string | null
  first_name: string
  last_name: string
  contact_no: string | null
  avatar_url: string | null
  status: DashboardDriverRecord["status"]
  created_at: Date
}

type DashboardTricycleRow = {
  tricycle_id: number
  toda_id: number
  toda_name: string
  barangay_id: number
  barangay_name: string
  plate_no: string
  reg_no: string | null
  permit_expiration_date: string | null
  status: DashboardTricycleRecord["status"]
  created_at: Date
}

type DashboardOperationalDriverRow = {
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
  status: DashboardDriverRecord["status"]
  latitude: number | null
  longitude: number | null
  speed: number | null
  heading: number | null
  accuracy: number | null
  is_online: boolean | null
  recorded_at: Date | null
  updated_at: Date | null
  active_trip_id: number | null
  active_trip_start: Date | null
  active_route_id: number | null
  active_route_origin: string | null
  active_route_destination: string | null
  total_alert_count: number
  open_alert_count: number
}

type DashboardViolationRow = {
  violation_id: string
  alert_source: DashboardViolationRecord["alertSource"]
  report_id: number | null
  driver_id: number | null
  driver_code: string | null
  first_name: string | null
  last_name: string | null
  toda_name: string | null
  barangay_name: string | null
  tricycle_id: number | null
  plate_no: string | null
  trip_id: number | null
  route_id: number | null
  route_origin: string | null
  route_destination: string | null
  violation_type_code: string
  violation_type_label: string
  severity: DashboardViolationSeverity
  description: string | null
  location_label: string | null
  latitude: number | null
  longitude: number | null
  detected_at: Date
  status: DashboardViolationStatus
}

type DashboardTripRow = {
  trip_id: number
  driver_id: number
  driver_code: string
  first_name: string
  last_name: string
  toda_name: string
  barangay_name: string
  tricycle_id: number
  plate_no: string
  route_id: number
  origin: string
  destination: string
  trip_start: Date
  trip_end: Date | null
  trip_status: DashboardTripRecord["tripStatus"]
  duration_minutes: number | null
  fare_amount: string | null
  distance_km: number | null
  path_point_count: number | null
  path_updated_at: Date | null
  violation_count: number | null
  report_count: number | null
  related_reports: DashboardTripReportRecord[] | null
  created_at: Date
}

type DashboardAggregateCountsRow = {
  completed_trips_today: number
}

declare global {
  // eslint-disable-next-line no-var
  var __triketrackNotificationReadsReady: Promise<void> | undefined
}

const ensureNotificationReadsReady = () => {
  if (!globalThis.__triketrackNotificationReadsReady) {
    globalThis.__triketrackNotificationReadsReady = (async () => {
      await ensureDatabaseReady()

      await query(`
        CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
          admin_id bigint NOT NULL REFERENCES public.admin_accounts(admin_id) ON DELETE CASCADE,
          notification_key text NOT NULL,
          read_at timestamptz NOT NULL DEFAULT NOW(),
          created_at timestamptz NOT NULL DEFAULT NOW(),
          PRIMARY KEY (admin_id, notification_key)
        )
      `)

      await query(`
        CREATE INDEX IF NOT EXISTS idx_admin_notification_reads_admin_read_at
        ON public.admin_notification_reads(admin_id, read_at DESC)
      `)
    })().catch((error) => {
      globalThis.__triketrackNotificationReadsReady = undefined
      throw error
    })
  }

  return globalThis.__triketrackNotificationReadsReady
}

const OPERATIONAL_TIMEZONE = "Asia/Manila"
const ONLINE_DRIVER_HEARTBEAT_WINDOW = "2 minutes"
const NOTIFICATION_TRIP_WINDOW_MS = 24 * 60 * 60 * 1000
const NOTIFICATION_DRIVER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const NOTIFICATION_LIMIT = 12

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

const appendSqlCondition = (clause: string, condition: string) =>
  clause ? `${clause} AND ${condition}` : `WHERE ${condition}`

const toIso = (value?: Date | null) => value?.toISOString()

const formatRouteName = (origin?: string | null, destination?: string | null) => {
  const routeName = [origin, destination]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" -> ")
  const normalized = routeName.replace(/→/g, "->").replace(/\s+/g, " ").toLowerCase()

  if (normalized === "test route -> live gps tracking") {
    return "Obrero Route"
  }

  if (normalized === "obrero -> route") {
    return "Obrero Route"
  }

  return routeName || undefined
}

const mapDriver = (row: DashboardDriverRow): DashboardDriverRecord => ({
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  tricycleNo: row.plate_no ?? undefined,
  qrId: row.qr_id === null ? undefined : Number(row.qr_id),
  passwordSet: Boolean(row.password_hash),
  firstName: row.first_name,
  lastName: row.last_name,
  contactNo: row.contact_no ?? undefined,
  avatarUrl: row.avatar_url ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapTricycle = (row: DashboardTricycleRow): DashboardTricycleRecord => ({
  tricycleId: Number(row.tricycle_id),
  todaId: Number(row.toda_id),
  todaName: row.toda_name,
  barangayId: Number(row.barangay_id),
  barangayName: row.barangay_name,
  plateNo: row.plate_no,
  regNo: row.reg_no ?? undefined,
  permitExpirationDate: row.permit_expiration_date ?? undefined,
  status: row.status,
  createdAt: row.created_at.toISOString()
})

const mapOperationalDriver = (
  row: DashboardOperationalDriverRow
): DashboardOperationalDriverRecord => {
  const isOnline = row.is_online === true
  const operationalStatus: DashboardOperationalDriverStatus =
    row.status === "suspended"
      ? "suspended"
      : row.status === "inactive"
        ? "inactive"
        : isOnline && row.active_trip_id !== null
          ? "on_trip"
          : isOnline
            ? "online_idle"
            : "offline"

  return {
    driverId: Number(row.driver_id),
    driverCode: row.driver_code,
    driverName: `${row.first_name} ${row.last_name}`,
    todaId: Number(row.toda_id),
    todaName: row.toda_name,
    barangayId: Number(row.barangay_id),
    barangayName: row.barangay_name,
    tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
    plateNo: row.plate_no ?? undefined,
    accountStatus: row.status,
    operationalStatus,
    isOnline,
    lastUpdateAt: toIso(row.recorded_at ?? row.updated_at),
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    speed: row.speed ?? undefined,
    heading: row.heading ?? undefined,
    accuracy: row.accuracy ?? undefined,
    activeTripId: row.active_trip_id === null ? undefined : Number(row.active_trip_id),
    activeTripStartedAt: toIso(row.active_trip_start),
    activeRouteId: row.active_route_id === null ? undefined : Number(row.active_route_id),
    activeRouteName: formatRouteName(row.active_route_origin, row.active_route_destination),
    totalAlertCount: Number(row.total_alert_count ?? 0),
    openAlertCount: Number(row.open_alert_count ?? 0)
  }
}

const mapViolation = (row: DashboardViolationRow): DashboardViolationRecord => ({
  violationId: row.violation_id,
  alertSource: row.alert_source,
  reportId: row.report_id === null ? undefined : Number(row.report_id),
  driverId: row.driver_id === null ? undefined : Number(row.driver_id),
  driverCode: row.driver_code ?? undefined,
  driverName:
    row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : undefined,
  todaName: row.toda_name ?? undefined,
  barangayName: row.barangay_name ?? undefined,
  tricycleId: row.tricycle_id === null ? undefined : Number(row.tricycle_id),
  plateNo: row.plate_no ?? undefined,
  tripId: row.trip_id === null ? undefined : Number(row.trip_id),
  routeId: row.route_id === null ? undefined : Number(row.route_id),
  routeName: formatRouteName(row.route_origin, row.route_destination),
  violationTypeCode: row.violation_type_code,
  violationTypeLabel: row.violation_type_label,
  severity: row.severity,
  description: row.description ?? undefined,
  locationLabel: row.location_label ?? undefined,
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  detectedAt: row.detected_at.toISOString(),
  status: row.status
})

const mapTrip = (row: DashboardTripRow): DashboardTripRecord => ({
  tripId: Number(row.trip_id),
  driverId: Number(row.driver_id),
  driverCode: row.driver_code,
  driverName: `${row.first_name} ${row.last_name}`,
  todaName: row.toda_name,
  barangayName: row.barangay_name,
  tricycleId: Number(row.tricycle_id),
  plateNo: row.plate_no,
  routeId: Number(row.route_id),
  routeName: formatRouteName(row.origin, row.destination) ?? "Obrero Route",
  tripStart: row.trip_start.toISOString(),
  tripEnd: row.trip_end?.toISOString(),
  tripStatus: row.trip_status,
  durationMinutes: row.duration_minutes ?? undefined,
  fareAmount: row.fare_amount === null ? undefined : Number(row.fare_amount),
  distanceKm: row.distance_km === null ? undefined : Number(row.distance_km),
  hasPath: Number(row.path_point_count ?? 0) > 1,
  pathPointCount:
    row.path_point_count === null ? undefined : Number(row.path_point_count),
  pathUpdatedAt: row.path_updated_at?.toISOString(),
  violationCount: Number(row.violation_count ?? 0),
  reportCount: Number(row.report_count ?? 0),
  issueCount: Number(row.violation_count ?? 0) + Number(row.report_count ?? 0),
  relatedReports: row.related_reports ?? [],
  createdAt: row.created_at.toISOString()
})

const getNotificationSortValue = (item: { timestamp: string; priority: number }) =>
  new Date(item.timestamp).getTime() * 1000 + item.priority

const sortNotifications = (
  a: DashboardNotificationRecord,
  b: DashboardNotificationRecord
) => getNotificationSortValue(b) - getNotificationSortValue(a)

const createNotifications = ({
  alerts,
  emergencies,
  trips,
  drivers,
  appeals,
  passwordResetRequests
}: {
  alerts: DashboardViolationRecord[]
  emergencies: DashboardEmergencyRecord[]
  trips: DashboardTripRecord[]
  drivers: DashboardDriverRecord[]
  appeals: AdminViolationAppealRecord[]
  passwordResetRequests: DriverPasswordResetRequestRecord[]
}) => {
  const nowTs = Date.now()

  const emergencyNotifications = emergencies
    .filter((emergency) => emergency.status !== "resolved")
    .slice(0, 8)
    .map<DashboardNotificationRecord>((emergency) => ({
      notificationKey: `emergency:${emergency.emergencyId}:${emergency.status}`,
      kind: "emergency",
      page: "alerts",
      title: `Emergency alert for ${emergency.driverName}`,
      body: [
        emergency.plateNo,
        emergency.routeName,
        emergency.locationLabel,
        [emergency.barangayName, emergency.todaName, emergency.status].filter(Boolean).join(" | ")
      ]
        .filter(Boolean)
        .join(" | "),
      timestamp: emergency.updatedAt,
      priority:
        emergency.status === "pending_admin" || emergency.status === "created"
          ? 140
          : emergency.status === "responding"
            ? 120
            : emergency.status === "acknowledged"
              ? 110
              : 80,
      tone: "danger",
      sourceEntityType: "emergency",
      sourceEntityId: String(emergency.emergencyId),
      isRead: false
    }))

  const violationNotifications = alerts
    .filter((alert) => alert.status !== "resolved" && alert.status !== "dismissed")
    .slice(0, 6)
    .map<DashboardNotificationRecord>((alert) => {
      const driverLabel =
        alert.driverName ??
        (alert.driverCode ? `Driver ${alert.driverCode}` : "Unassigned driver")
      const details = [
        alert.violationTypeLabel,
        alert.locationLabel,
        alert.description,
        alert.routeName,
        [alert.barangayName, alert.todaName, alert.status].filter(Boolean).join(" | ")
      ].filter(Boolean)

      return {
        notificationKey: `alert:${alert.alertSource}:${alert.violationId}`,
        kind: "violation",
        page: "alerts",
        title: `${driverLabel} alert`,
        body: details.join(" | "),
        timestamp: alert.detectedAt,
        priority:
          (alert.severity === "high" ? 95 : alert.severity === "medium" ? 70 : 50) +
          (alert.status === "open" ? 20 : 0),
        tone: alert.severity === "high" ? "danger" : "warn",
        sourceEntityType: "alert",
        sourceEntityId: alert.violationId,
        isRead: false
      }
    })

  const tripNotifications = trips
    .filter((trip) => {
      const ts = new Date(trip.tripEnd ?? trip.tripStart).getTime()
      return nowTs - ts <= NOTIFICATION_TRIP_WINDOW_MS
    })
    .slice(0, 6)
    .map<DashboardNotificationRecord>((trip) => {
      const title =
        trip.tripStatus === "ongoing"
          ? `Trip in progress for ${trip.driverName}`
          : trip.tripStatus === "cancelled"
            ? `Trip cancelled for ${trip.driverName}`
            : trip.tripStatus === "completed"
              ? `Trip completed for ${trip.driverName}`
              : `Trip scheduled for ${trip.driverName}`

      return {
        notificationKey: `trip:${trip.tripId}:${trip.tripStatus}`,
        kind: "trip",
        page: "trip-logs",
        title,
        body: [
          trip.driverCode,
          trip.plateNo,
          trip.routeName,
          trip.violationCount > 0 ? `${trip.violationCount} alert(s)` : undefined
        ]
          .filter(Boolean)
          .join(" | "),
        timestamp: trip.tripEnd ?? trip.tripStart,
        priority:
          trip.tripStatus === "ongoing"
            ? 82
            : trip.tripStatus === "cancelled"
              ? 72
              : trip.tripStatus === "completed"
                ? 60
                : 45,
        tone: trip.tripStatus === "cancelled" ? "warn" : "info",
        sourceEntityType: "trip",
        sourceEntityId: String(trip.tripId),
        isRead: false
      }
    })

  const driverNotifications = drivers
    .flatMap<DashboardNotificationRecord>((driver) => {
      const createdTs = new Date(driver.createdAt).getTime()
      const body = `${driver.driverCode} | ${driver.todaName} | Status ${driver.status}`

      if (driver.status === "suspended") {
        return [
          {
            notificationKey: `driver:${driver.driverId}:suspended`,
            kind: "driver",
            page: "drivers",
            title: `Driver suspended: ${driver.firstName} ${driver.lastName}`,
            body,
            timestamp: driver.createdAt,
            priority: 72,
            tone: "danger",
            sourceEntityType: "driver",
            sourceEntityId: String(driver.driverId),
            isRead: false
          }
        ]
      }

      if (driver.status === "inactive") {
        return [
          {
            notificationKey: `driver:${driver.driverId}:inactive`,
            kind: "driver",
            page: "drivers",
            title: `Driver inactive: ${driver.firstName} ${driver.lastName}`,
            body,
            timestamp: driver.createdAt,
            priority: 58,
            tone: "warn",
            sourceEntityType: "driver",
            sourceEntityId: String(driver.driverId),
            isRead: false
          }
        ]
      }

      if (!driver.passwordSet) {
        return [
          {
            notificationKey: `driver:${driver.driverId}:password_pending`,
            kind: "driver",
            page: "drivers",
            title: `Driver setup pending: ${driver.firstName} ${driver.lastName}`,
            body,
            timestamp: driver.createdAt,
            priority: 48,
            tone: "warn",
            sourceEntityType: "driver",
            sourceEntityId: String(driver.driverId),
            isRead: false
          }
        ]
      }

      if (nowTs - createdTs <= NOTIFICATION_DRIVER_WINDOW_MS) {
        return [
          {
            notificationKey: `driver:${driver.driverId}:new_driver`,
            kind: "driver",
            page: "drivers",
            title: `New driver added: ${driver.firstName} ${driver.lastName}`,
            body,
            timestamp: driver.createdAt,
            priority: 38,
            tone: "info",
            sourceEntityType: "driver",
            sourceEntityId: String(driver.driverId),
            isRead: false
          }
        ]
      }

      return []
    })
    .sort(sortNotifications)
    .slice(0, 5)

  const appealNotifications = appeals
    .filter((appeal) => appeal.status === "submitted")
    .slice(0, 6)
    .map<DashboardNotificationRecord>((appeal) => ({
      notificationKey: `appeal:${appeal.appealId}`,
      kind: "appeal",
      page: "reports",
      title: `New appeal from ${appeal.driverName}`,
      body: [
        appeal.violationTypeLabel,
        appeal.appealReason,
        appeal.routeName,
        appeal.plateNo,
        [appeal.barangayName, appeal.todaName].filter(Boolean).join(" | ")
      ]
        .filter(Boolean)
        .join(" | "),
      timestamp: appeal.submittedAt,
      priority: 88,
      tone: "warn",
      sourceEntityType: "appeal",
      sourceEntityId: appeal.appealId,
      isRead: false
    }))

  const passwordResetNotifications = passwordResetRequests
    .filter((request) => request.status === "pending")
    .slice(0, 8)
    .map<DashboardNotificationRecord>((request) => ({
      notificationKey: `password-reset:${request.requestId}:${request.status}`,
      kind: "password_reset",
      page: "drivers",
      title: `Password reset request: ${request.driverName}`,
      body: [
        request.driverCode,
        request.todaName,
        request.barangayName,
        "Admin verification required"
      ].join(" | "),
      timestamp: request.requestedAt,
      priority: 92,
      tone: "warn",
      sourceEntityType: "password_reset",
      sourceEntityId: String(request.requestId),
      isRead: false
    }))

  return [
    ...emergencyNotifications,
    ...violationNotifications,
    ...tripNotifications,
    ...driverNotifications,
    ...appealNotifications,
    ...passwordResetNotifications
  ]
    .sort(sortNotifications)
    .slice(0, NOTIFICATION_LIMIT)
}

const loadReadNotificationKeys = async (adminId: number, notificationKeys: string[]) => {
  if (notificationKeys.length === 0) {
    return new Set<string>()
  }

  await ensureNotificationReadsReady()

  const result = await query<{ notification_key: string }>(
    `
      SELECT notification_key
      FROM public.admin_notification_reads
      WHERE admin_id = $1
        AND notification_key = ANY($2::text[])
    `,
    [adminId, notificationKeys]
  )

  return new Set(result.rows.map((row) => row.notification_key))
}

export const markDashboardNotificationsRead = async (
  adminId: number,
  notificationKeys: string[]
) => {
  await ensureNotificationReadsReady()

  const uniqueKeys = [...new Set(notificationKeys.map((key) => key.trim()).filter(Boolean))]
  if (uniqueKeys.length === 0) {
    return
  }

  await query(
    `
      INSERT INTO public.admin_notification_reads (
        admin_id,
        notification_key,
        read_at
      )
      SELECT
        $1::bigint,
        notification_key,
        NOW()
      FROM UNNEST($2::text[]) AS notification_key
      ON CONFLICT (admin_id, notification_key) DO UPDATE
      SET read_at = EXCLUDED.read_at
    `,
    [adminId, uniqueKeys]
  )
}

export const getDashboardDataForAdmin = async (profile: AdminProfile) => {
  await ensureDatabaseReady()
  await ensureNotificationReadsReady()
  await ensureViolationStorageReady()
  await runOperationalAnomalyDetection()
  await ensureDriverPasswordResetReady()

  const driverScope = buildScopeClause(profile, "d.toda_id", "b.barangay_id")
  const tricycleScope = buildScopeClause(profile, "tr.toda_id", "b.barangay_id")
  const tripScope = buildScopeClause(profile, "td.toda_id", "b.barangay_id")
  const alertScope = buildScopeClause(profile, "td.toda_id", "b.barangay_id")
  const activeDriverScope = appendSqlCondition(driverScope.clause, "d.deleted_at IS NULL")
  const mobileMirrorExclusion = "COALESCE(mv.dedupe_key, '') NOT LIKE 'system-violation:%'"
  const mobileAlertScope = appendSqlCondition(alertScope.clause, mobileMirrorExclusion)
  const driverAvatarSelect = (await hasColumn("public", "drivers", "avatar_url"))
    ? "d.avatar_url"
    : "NULL::text AS avatar_url"
  const hasMobileViolations = await hasTable("public", "mobile_violations")
  const hasTripPaths = await hasTable("public", "trip_paths")
  const mobileAlertCountsUnion = hasMobileViolations
    ? `
            UNION ALL

            SELECT
              mv.driver_id,
              LOWER(mv.status::text) AS status
            FROM public.mobile_violations mv
            WHERE ${mobileMirrorExclusion}
      `
    : ""
  const mobileViolationsUnion = hasMobileViolations
    ? `
          UNION ALL

          SELECT
            CONCAT('driver-', mv.id)::text AS violation_id,
            'driver_violation'::text AS alert_source,
            NULL::bigint AS report_id,
            d.driver_id,
            d.driver_code,
            d.first_name,
            d.last_name,
            td.toda_name,
            b.barangay_name,
            d.tricycle_id,
            tr.plate_no,
            tp.trip_id,
            r.route_id,
            r.origin AS route_origin,
            r.destination AS route_destination,
            LOWER(mv.type::text) AS violation_type_code,
            INITCAP(REPLACE(LOWER(mv.type::text), '_', ' ')) AS violation_type_label,
            LOWER(mv.priority::text)::text AS severity,
            COALESCE(mv.title, mv.details) AS description,
            mv.location_label,
            mv.latitude,
            mv.longitude,
            mv.occurred_at AS detected_at,
            LOWER(mv.status::text)::text AS status
          FROM public.mobile_violations mv
          JOIN public.drivers d
            ON d.driver_id = mv.driver_id
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
          ${mobileAlertScope}
      `
    : ""
  const mobileTripAlertsUnion = hasMobileViolations
    ? `
            UNION ALL

            SELECT 1
            FROM public.mobile_violations mv
            WHERE mv.trip_id = tp.trip_id
      `
    : ""
  const tripPathSelect = hasTripPaths
    ? `
          COALESCE(NULLIF(tp.raw_gps_point_count, 0), path.point_count) AS path_point_count,
          COALESCE(path.updated_at, tp.trip_end, tp.created_at) AS path_updated_at,
      `
    : `
          NULLIF(tp.raw_gps_point_count, 0) AS path_point_count,
          COALESCE(tp.trip_end, tp.created_at) AS path_updated_at,
      `
  const tripPathJoin = hasTripPaths
    ? `
        LEFT JOIN public.trip_paths path
          ON path.trip_id = tp.trip_id
      `
    : ""

  const [
    driversResult,
    tricyclesResult,
    operationalDriversResult,
    violationsResult,
    emergencyAlerts,
    appeals,
    passwordResetRequests,
    tripsResult,
    aggregateCountsResult
  ] = await Promise.all([
    query<DashboardDriverRow>(
      `
        SELECT
          d.driver_id,
          d.driver_code,
          d.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          d.tricycle_id,
          tr.plate_no,
          d.qr_id,
          d.password_hash,
          d.first_name,
          d.last_name,
          d.contact_no,
          ${driverAvatarSelect},
          d.status,
          d.created_at
        FROM public.drivers d
        JOIN public.todas t
          ON t.toda_id = d.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        LEFT JOIN public.tricycles tr
          ON tr.tricycle_id = d.tricycle_id
        ${activeDriverScope}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, d.last_name ASC, d.first_name ASC
      `,
      driverScope.params
    ),
    query<DashboardTricycleRow>(
      `
        SELECT
          tr.tricycle_id,
          tr.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          tr.plate_no,
          tr.reg_no,
          tr.permit_expiration_date,
          tr.status,
          tr.created_at
        FROM public.tricycles tr
        JOIN public.todas t
          ON t.toda_id = tr.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        ${tricycleScope.clause}
        ORDER BY b.barangay_name ASC, t.toda_name ASC, tr.plate_no ASC
      `,
      tricycleScope.params
    ),
    query<DashboardOperationalDriverRow>(
      `
        WITH active_trips AS (
          SELECT DISTINCT ON (tp.driver_id)
            tp.driver_id,
            tp.trip_id,
            tp.trip_start,
            tp.route_id,
            r.origin,
            r.destination
          FROM public.trips tp
          JOIN public.routes r
            ON r.route_id = tp.route_id
          WHERE tp.trip_status = 'ongoing'
            AND tp.trip_end IS NULL
          ORDER BY tp.driver_id, tp.trip_start DESC, tp.trip_id DESC
        ),
        alert_counts AS (
          SELECT
            driver_id,
            COUNT(*)::int AS total_alert_count,
            COUNT(*) FILTER (
              WHERE status NOT IN ('resolved', 'dismissed')
            )::int AS open_alert_count
          FROM (
            SELECT
              v.driver_id,
              LOWER(v.status::text) AS status
            FROM public.violations v
            WHERE v.driver_id IS NOT NULL
            ${mobileAlertCountsUnion}
          ) alert_source
          GROUP BY driver_id
        )
        SELECT
          d.driver_id,
          d.driver_code,
          d.first_name,
          d.last_name,
          d.toda_id,
          t.toda_name,
          b.barangay_id,
          b.barangay_name,
          d.tricycle_id,
          tr.plate_no,
          d.status,
          dl.latitude,
          dl.longitude,
          dl.speed,
          dl.heading,
          dl.accuracy,
          CASE
            WHEN d.status = 'active'
              AND dl.is_online = TRUE
              AND COALESCE(dl.updated_at, dl.recorded_at) >= NOW() - INTERVAL '${ONLINE_DRIVER_HEARTBEAT_WINDOW}'
            THEN TRUE
            ELSE FALSE
          END AS is_online,
          dl.recorded_at,
          dl.updated_at,
          at.trip_id AS active_trip_id,
          at.trip_start AS active_trip_start,
          at.route_id AS active_route_id,
          at.origin AS active_route_origin,
          at.destination AS active_route_destination,
          COALESCE(ac.total_alert_count, 0) AS total_alert_count,
          COALESCE(ac.open_alert_count, 0) AS open_alert_count
        FROM public.drivers d
        JOIN public.todas t
          ON t.toda_id = d.toda_id
        JOIN public.barangays b
          ON b.barangay_id = t.barangay_id
        LEFT JOIN public.tricycles tr
          ON tr.tricycle_id = d.tricycle_id
        LEFT JOIN public.driver_locations dl
          ON dl.driver_id = d.driver_id
        LEFT JOIN active_trips at
          ON at.driver_id = d.driver_id
        LEFT JOIN alert_counts ac
          ON ac.driver_id = d.driver_id
        ${activeDriverScope}
        ORDER BY
          CASE
            WHEN d.status = 'active'
              AND dl.is_online = TRUE
              AND COALESCE(dl.updated_at, dl.recorded_at) >= NOW() - INTERVAL '${ONLINE_DRIVER_HEARTBEAT_WINDOW}'
            THEN TRUE
            ELSE FALSE
          END DESC,
          COALESCE(dl.recorded_at, dl.updated_at) DESC NULLS LAST,
          d.last_name ASC,
          d.first_name ASC
      `,
      driverScope.params
    ),
    query<DashboardViolationRow>(
      `
        SELECT *
        FROM (
          SELECT
            CONCAT('system-', v.violation_id)::text AS violation_id,
            'system_violation'::text AS alert_source,
            v.report_id,
            d.driver_id,
            d.driver_code,
            d.first_name,
            d.last_name,
            td.toda_name,
            b.barangay_name,
            COALESCE(v.tricycle_id, d.tricycle_id) AS tricycle_id,
            tr.plate_no,
            tp.trip_id,
            r.route_id,
            r.origin AS route_origin,
            r.destination AS route_destination,
            vt.code AS violation_type_code,
            vt.label AS violation_type_label,
            CASE
              WHEN vt.code = 'geofence_deviation' THEN 'high'
            ELSE 'medium'
            END::text AS severity,
            v.description,
            v.location_label,
            v.latitude,
            v.longitude,
            v.detected_at,
            LOWER(v.status::text)::text AS status
          FROM public.violations v
          JOIN public.violation_types vt
            ON vt.violation_type_id = v.violation_type_id
          LEFT JOIN public.drivers d
            ON d.driver_id = v.driver_id
          LEFT JOIN public.tricycles tr
            ON tr.tricycle_id = COALESCE(v.tricycle_id, d.tricycle_id)
          LEFT JOIN public.trips tp
            ON tp.trip_id = v.trip_id
          LEFT JOIN public.routes r
            ON r.route_id = tp.route_id
          LEFT JOIN public.todas td
            ON td.toda_id = COALESCE(d.toda_id, r.toda_id)
          LEFT JOIN public.barangays b
            ON b.barangay_id = td.barangay_id
          ${alertScope.clause}
          ${mobileViolationsUnion}
        ) scoped_alerts
        ORDER BY detected_at DESC, violation_id DESC
        LIMIT 100
      `,
      alertScope.params
    ),
    listEmergencyAlertsForAdmin(profile, {
      limit: 50
    }),
    listAppealsForAdmin(profile),
    listDriverPasswordResetRequestsForAdmin(profile),
    query<DashboardTripRow>(
      `
        SELECT
          tp.trip_id,
          d.driver_id,
          d.driver_code,
          d.first_name,
          d.last_name,
          td.toda_name,
          b.barangay_name,
          tr.tricycle_id,
          tr.plate_no,
          r.route_id,
          r.origin,
          r.destination,
          tp.trip_start,
          tp.trip_end,
          tp.trip_status::text AS trip_status,
          tp.duration_minutes,
          tp.fare_amount,
          COALESCE(
            NULLIF(tp.trip_metrics #>> '{routeMatchSummary,distanceMeters}', '')::numeric / 1000.0,
            dist.distance_km
          ) AS distance_km,
          ${tripPathSelect}
          COALESCE(violations.violation_count, 0) AS violation_count,
          COALESCE(reports.report_count, 0) AS report_count,
          COALESCE(reports.related_reports, '[]'::jsonb) AS related_reports,
          tp.created_at
        FROM public.trips tp
        JOIN public.drivers d
          ON d.driver_id = tp.driver_id
        JOIN public.tricycles tr
          ON tr.tricycle_id = tp.tricycle_id
        JOIN public.routes r
          ON r.route_id = tp.route_id
        JOIN public.todas td
          ON td.toda_id = r.toda_id
        JOIN public.barangays b
          ON b.barangay_id = td.barangay_id
        ${tripPathJoin}
        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN COUNT(*) = 0 THEN NULL
              ELSE COALESCE(SUM(
                CASE
                  WHEN path.prev_lat IS NULL OR path.prev_lng IS NULL THEN 0
                  ELSE 6371 * ACOS(
                    GREATEST(
                      -1,
                      LEAST(
                        1,
                        COS(RADIANS(path.prev_lat))
                          * COS(RADIANS(path.lat))
                          * COS(RADIANS(path.lng) - RADIANS(path.prev_lng))
                          + SIN(RADIANS(path.prev_lat)) * SIN(RADIANS(path.lat))
                      )
                    )
                  )
                END
              ), 0)
            END AS distance_km
          FROM (
            SELECT
              trp.lat AS lat,
              trp.lng AS lng,
              LAG(trp.lat) OVER (ORDER BY trp.recorded_at ASC, trp.point_id ASC) AS prev_lat,
              LAG(trp.lng) OVER (ORDER BY trp.recorded_at ASC, trp.point_id ASC) AS prev_lng
            FROM public.trip_points trp
            WHERE trp.trip_id = tp.trip_id
          ) path
        ) dist ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS violation_count
          FROM (
            SELECT 1
            FROM public.violations v
            WHERE v.trip_id = tp.trip_id
              AND v.report_id IS NULL
            ${mobileTripAlertsUnion}
          ) trip_alerts
        ) violations ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::int AS report_count,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'reportId', r.report_id,
                  'reportTypeLabel', rt.label,
                  'passengerName', r.passenger_name,
                  'description', r.description,
                  'reportedAt', r.reported_at,
                  'status', r.status
                )
                ORDER BY r.reported_at DESC, r.report_id DESC
              ),
              '[]'::jsonb
            ) AS related_reports
          FROM public.reports r
          JOIN public.report_types rt
            ON rt.report_type_id = r.report_type_id
          WHERE r.trip_id = tp.trip_id
        ) reports ON TRUE
        ${tripScope.clause}
        ORDER BY COALESCE(tp.trip_end, tp.trip_start) DESC, tp.trip_id DESC
        LIMIT 100
      `,
      tripScope.params
    ),
    query<DashboardAggregateCountsRow>(
      `
        SELECT
          COUNT(*)::int AS completed_trips_today
        FROM public.trips tp
        JOIN public.routes r
          ON r.route_id = tp.route_id
        JOIN public.todas td
          ON td.toda_id = r.toda_id
        JOIN public.barangays b
          ON b.barangay_id = td.barangay_id
        ${
          tripScope.clause
            ? `${tripScope.clause}
        AND`
            : "WHERE"
        }
          tp.trip_status = 'completed'
          AND tp.trip_end IS NOT NULL
          AND (tp.trip_end AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::date =
            (NOW() AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::date
      `,
      tripScope.params
    )
  ])

  const drivers = driversResult.rows.map(mapDriver)
  const tricycles = tricyclesResult.rows.map(mapTricycle)
  const operationalDrivers = operationalDriversResult.rows.map(mapOperationalDriver)
  const recentViolations = violationsResult.rows.map(mapViolation)
  const recentEmergencies = emergencyAlerts
  const recentTrips = tripsResult.rows.map(mapTrip)
  const completedTripsToday = Number(
    aggregateCountsResult.rows[0]?.completed_trips_today ?? 0
  )

  const notifications = createNotifications({
    alerts: recentViolations,
    emergencies: recentEmergencies,
    trips: recentTrips,
    drivers,
    appeals,
    passwordResetRequests
  })

  const readKeys = await loadReadNotificationKeys(
    profile.adminId,
    notifications.map((item) => item.notificationKey)
  )

  const notificationsWithReadState = notifications.map((item) => ({
    ...item,
    isRead:
      item.kind === "appeal"
        ? appeals.some((appeal) => appeal.appealId === item.sourceEntityId && Boolean(appeal.viewedAt)) ||
          readKeys.has(item.notificationKey)
        : readKeys.has(item.notificationKey)
  }))

  const onlineDrivers = operationalDrivers.filter((driver) => driver.isOnline)
  const activeTricycles = new Set(
    onlineDrivers.map((driver) =>
      driver.tricycleId !== undefined ? `tricycle-${driver.tricycleId}` : `driver-${driver.driverId}`
    )
  ).size
  const ongoingTrips = new Set(
    operationalDrivers
      .filter((driver) => driver.operationalStatus === "on_trip")
      .map((driver) => driver.activeTripId)
      .filter((tripId): tripId is number => typeof tripId === "number")
  ).size
  const openAlerts = operationalDrivers.reduce(
    (total, driver) => total + driver.openAlertCount,
    0
  ) + recentEmergencies.filter((item) => item.status !== "resolved").length

  return {
    drivers,
    tricycles,
    operationalDrivers,
    recentViolations,
    recentEmergencies,
    recentTrips,
    passwordResetRequests,
    notifications: notificationsWithReadState,
    counts: {
      drivers: drivers.length,
      tricycles: tricycles.length,
      onlineDrivers: onlineDrivers.length,
      activeTricycles,
      ongoingTrips,
      tripsToday: completedTripsToday,
      completedTripsToday,
      openAlerts,
      unreadNotifications: notificationsWithReadState.filter((item) => !item.isRead).length
    }
  } satisfies DashboardDataSnapshot
}
